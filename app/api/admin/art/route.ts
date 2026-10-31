import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { artServiceClient, CONTEST_COLUMNS } from "@/lib/art-server";

// GET - every art contest for the admin list, newest first, with counts.
export async function GET() {
  const { allowed } = await checkPermission("manage_art");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: contests, error } = await supabase.from("art_contests").select(CONTEST_COLUMNS).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load art contests." }, { status: 500 });
  const ids = (contests ?? []).map((c) => c.id);
  const [{ data: entries }, { data: votes }] = ids.length
    ? await Promise.all([
        supabase.from("art_entries").select("contest_id, status").in("contest_id", ids),
        supabase.from("art_votes").select("contest_id, voter_key").in("contest_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  return NextResponse.json({
    contests: (contests ?? []).map((c) => {
      const mine = (entries ?? []).filter((e) => e.contest_id === c.id);
      return {
        ...c,
        entryCount: mine.filter((e) => e.status !== "withdrawn").length,
        pendingCount: mine.filter((e) => e.status === "pending").length,
        approvedCount: mine.filter((e) => e.status === "approved").length,
        voterCount: new Set((votes ?? []).filter((v) => v.contest_id === c.id).map((v) => v.voter_key)).size,
      };
    }),
  });
}

// POST - start a new draft contest, blank or with an earlier one's settings.
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_art");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return NextResponse.json({ error: "Give the contest a name." }, { status: 400 });
  let base: Record<string, unknown> = {};
  if (typeof body.copyFrom === "string" && body.copyFrom) {
    const { data } = await supabase
      .from("art_contests")
      .select("description, rules, submit_eligibility, entry_visibility, max_entries_per_person, max_images_per_entry, votes_per_voter, vote_eligibility, show_live_results, comments_visibility, anonymous_voting")
      .eq("id", body.copyFrom)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "The contest to copy wasn't found." }, { status: 404 });
    base = data;
  }
  const { data: contest, error } = await supabase
    .from("art_contests")
    .insert({ ...base, name, status: "draft", created_by: user?.discord_username ?? null })
    .select("id")
    .single();
  if (error || !contest) return NextResponse.json({ error: "Couldn't create the contest." }, { status: 500 });
  return NextResponse.json({ id: contest.id });
}
