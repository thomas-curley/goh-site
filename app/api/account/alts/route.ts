import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { WOM_GROUP_ID } from "@/lib/constants";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - list the caller's own linked alts.
export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("user_alt_rsns")
    .select("id, rsn, clan_rank, linked_at")
    .eq("user_id", user.id)
    .order("linked_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Failed to load alts." }, { status: 500 });

  return NextResponse.json({ alts: data ?? [] });
}

// POST - link an additional RSN as an alt. Same lightweight trust model as
// the main RSN (lib/rank-resolution.ts's comment on this): exists on WOM
// and isn't already claimed by anyone else on the site -- there's no
// stronger ownership proof for the main RSN either, so alts aren't held to
// a higher bar.
export async function POST(request: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const rsnInput = typeof body.rsn === "string" ? body.rsn.trim() : "";
  if (!rsnInput) {
    return NextResponse.json({ error: "Enter an RSN." }, { status: 400 });
  }

  const womRes = await fetch(`https://api.wiseoldman.net/v2/players/${encodeURIComponent(rsnInput)}`);
  if (!womRes.ok) {
    return NextResponse.json(
      { error: `Player "${rsnInput}" not found on Wise Old Man. Make sure it's been tracked at least once.` },
      { status: 400 }
    );
  }
  const womPlayer = await womRes.json();

  // Same capitalization fallback as the main RSN-linking flow: WOM only has
  // capitalization if the player was first tracked with it.
  const typed = rsnInput.replace(/[-_]/g, " ").replace(/\s+/g, " ");
  const womName: string = womPlayer.displayName ?? typed;
  const displayRsn = womName === womName.toLowerCase() ? typed : womName;

  const { data: existingMain } = await supabase
    .from("user_profiles")
    .select("id, discord_username")
    .ilike("rsn", displayRsn)
    .maybeSingle();
  if (existingMain) {
    const message = existingMain.id === user.id
      ? `"${displayRsn}" is already your linked main RSN.`
      : `"${displayRsn}" is already linked to another account.`;
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const { data: existingAlt } = await supabase
    .from("user_alt_rsns")
    .select("id, user_id")
    .ilike("rsn", displayRsn)
    .maybeSingle();
  if (existingAlt) {
    const message = existingAlt.user_id === user.id
      ? `"${displayRsn}" is already one of your alts.`
      : `"${displayRsn}" is already linked to another account.`;
    return NextResponse.json({ error: message }, { status: 409 });
  }

  // Check if this RSN is in our WOM group (optional -- for clan_rank).
  let clanRank: string | null = null;
  try {
    const groupRes = await fetch(`https://api.wiseoldman.net/v2/groups/${WOM_GROUP_ID}`);
    if (groupRes.ok) {
      const group = await groupRes.json();
      const membership = group.memberships?.find(
        (m: { player: { username: string }; role: string }) => m.player.username === womPlayer.username
      );
      if (membership) clanRank = membership.role;
    }
  } catch {
    // Non-critical
  }

  const { data: inserted, error } = await supabase
    .from("user_alt_rsns")
    .insert({ user_id: user.id, rsn: displayRsn, clan_rank: clanRank })
    .select("id, rsn, clan_rank, linked_at")
    .single();

  if (error) return NextResponse.json({ error: "Failed to link alt." }, { status: 500 });

  return NextResponse.json({ alt: inserted }, { status: 201 });
}
