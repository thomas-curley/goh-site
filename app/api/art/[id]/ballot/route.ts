import { NextRequest, NextResponse } from "next/server";
import { artServiceClient, canSeeEntry, ENTRY_COLUMNS, getArtViewer, loadContest, voterKeyFor } from "@/lib/art-server";
import type { ArtEntry } from "@/lib/art";

// PUT { picks: [{ entryId, comment? }] } - save the viewer's ballot,
// replacing any earlier one: up to votes_per_voter different entries, none
// of them their own. Voters can change their picks until voting closes.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const [contest, viewer] = await Promise.all([loadContest(supabase, id), getArtViewer(supabase)]);
  if (!contest) return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  const voter = voterKeyFor(contest, viewer, request);
  if ("error" in voter) return NextResponse.json({ error: voter.error }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const raw: { entryId?: unknown; comment?: unknown }[] = Array.isArray(body.picks) ? body.picks : [];
  const picks = new Map<string, string | null>();
  for (const p of raw) {
    if (typeof p?.entryId !== "string") continue;
    const comment = contest.comments_visibility !== "off" && typeof p.comment === "string" ? p.comment.trim().slice(0, 500) || null : null;
    picks.set(p.entryId, comment);
  }
  if (picks.size > contest.votes_per_voter) {
    return NextResponse.json({ error: `You can pick up to ${contest.votes_per_voter} ${contest.votes_per_voter === 1 ? "entry" : "entries"}.` }, { status: 400 });
  }
  if (picks.size) {
    const { data } = await supabase.from("art_entries").select(ENTRY_COLUMNS).eq("contest_id", id).in("id", [...picks.keys()]);
    const entries = (data ?? []) as ArtEntry[];
    for (const entryId of picks.keys()) {
      const e = entries.find((x) => x.id === entryId);
      if (!e || e.status !== "approved" || !canSeeEntry(e, viewer)) return NextResponse.json({ error: "One of those entries isn't in the vote." }, { status: 400 });
      if (viewer.userId && e.user_id === viewer.userId) return NextResponse.json({ error: "You can't vote for your own entry." }, { status: 400 });
    }
  }
  await supabase.from("art_votes").delete().eq("contest_id", id).eq("voter_key", voter.key);
  if (picks.size) {
    const { error } = await supabase.from("art_votes").insert(
      [...picks.entries()].map(([entry_id, comment]) => ({ contest_id: id, entry_id, voter_key: voter.key, voter_user_id: viewer.userId, voter_name: voter.name, comment }))
    );
    if (error) return NextResponse.json({ error: "Couldn't save your votes. Try again." }, { status: 500 });
  }
  return NextResponse.json({ saved: true, votes: picks.size });
}
