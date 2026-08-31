import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkInToEvent } from "@/lib/event-checkin";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_NAME_LENGTH = 40;

// POST - self check-in for an event using the caller's own authenticated session.
// The discord identity is always read from the session/profile, never from the
// request body, so a signed-in user can only check themselves in.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in to check in." }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", id)
    .single();
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("discord_id, discord_username, discord_nickname, rsn, rsn_verified")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.discord_id) {
    return NextResponse.json(
      { error: "We couldn't find your Discord profile. Try logging out and back in." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const manualName = typeof body.manualName === "string" ? body.manualName.trim().slice(0, MAX_NAME_LENGTH) : "";
  const code = typeof body.code === "string" ? body.code : undefined;

  let displayName: string;
  let source: string;
  if (profile.rsn_verified && profile.rsn && !manualName) {
    displayName = profile.rsn;
    source = "self_checkin";
  } else if (manualName) {
    displayName = manualName;
    source = "self_checkin_unverified";
  } else {
    return NextResponse.json(
      { error: "Enter your RSN or name to check in." },
      { status: 400 }
    );
  }

  const result = await checkInToEvent(
    supabase,
    id,
    { discordId: profile.discord_id, discordUsername: profile.discord_username, discordNickname: profile.discord_nickname, rsn: displayName },
    source,
    code
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error, codeRequired: result.codeRequired ?? false }, { status: result.status });
  }

  return NextResponse.json({ checkedIn: true, name: result.name, verified: source === "self_checkin" });
}
