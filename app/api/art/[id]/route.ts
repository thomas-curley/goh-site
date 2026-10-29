import { NextRequest, NextResponse } from "next/server";
import { artServiceClient, canSeeEntry, canSubmit, ENTRY_COLUMNS, getArtViewer, loadContest, signImages, voterKeyFor } from "@/lib/art-server";
import { creditName, rankEntries, type ArtEntry } from "@/lib/art";

// GET - one contest for the member page: settings, what the viewer can do,
// their own entries, and (once voting opens) the entries they may see, with
// counts and comments only as the contest's settings allow. While voting is
// anonymous, artists' names are left out of everyone else's entries.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const [contest, viewer] = await Promise.all([loadContest(supabase, id), getArtViewer(supabase)]);
  if (!contest || (contest.status === "draft" && !viewer.isStaff)) return NextResponse.json({ error: "Contest not found." }, { status: 404 });

  const { data: rows } = await supabase.from("art_entries").select(ENTRY_COLUMNS).eq("contest_id", id).neq("status", "withdrawn").order("created_at");
  const all = (rows ?? []) as ArtEntry[];
  const mine = viewer.userId ? all.filter((e) => e.user_id === viewer.userId) : [];
  const showBoard = contest.status === "voting" || contest.status === "completed";
  const board = showBoard ? all.filter((e) => e.status === "approved" && canSeeEntry(e, viewer)) : [];

  const voter = voterKeyFor(contest, viewer, request);
  const voterKey = "key" in voter ? voter.key : viewer.userId ? `user:${viewer.userId}` : null;
  const [{ data: votes }, { data: myVotes }] = await Promise.all([
    supabase.from("art_votes").select("entry_id, comment, comment_hidden, voter_name, created_at").eq("contest_id", id),
    voterKey ? supabase.from("art_votes").select("entry_id, comment").eq("contest_id", id).eq("voter_key", voterKey) : Promise.resolve({ data: [] }),
  ]);
  const finished = contest.status === "completed";
  const countsVisible = finished || (contest.show_live_results && contest.status === "voting") || viewer.isStaff;
  const results = countsVisible ? rankEntries(board.map((e) => e.id), votes ?? []) : [];
  const commentsFor = (entry: ArtEntry) => {
    const vis = contest.comments_visibility;
    const own = viewer.userId && entry.user_id === viewer.userId;
    const allowed = vis === "live" || (vis === "after" && finished) || (vis === "private" && (own || viewer.isStaff)) || (viewer.isStaff && vis !== "off");
    if (!allowed) return [];
    return (votes ?? [])
      .filter((v) => v.entry_id === entry.id && v.comment && !v.comment_hidden)
      .map((v) => ({ comment: v.comment as string, by: v.voter_name, at: v.created_at }));
  };

  const urls = await signImages(supabase, [...board, ...mine].flatMap((e) => e.image_paths));
  const hideNames = contest.anonymous_voting && contest.status === "voting" && !viewer.isStaff;
  const shape = (e: ArtEntry) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    images: e.image_paths.map((p) => urls[p]).filter(Boolean),
    artist: hideNames && e.user_id !== viewer.userId ? null : creditName(e),
    visibility: e.visibility,
    isMine: !!viewer.userId && e.user_id === viewer.userId,
    comments: commentsFor(e),
  });
  const submit = canSubmit(contest, viewer);
  return NextResponse.json({
    contest,
    entries: board.map(shape),
    results,
    countsVisible,
    myEntries: mine.map((e) => ({ ...shape(e), status: e.status, review_note: e.review_note, credit: e.credit, credit_name: e.credit_name, gallery_opt_in: e.gallery_opt_in, image_paths: e.image_paths })),
    myBallot: (myVotes ?? []).map((v) => ({ entryId: v.entry_id, comment: v.comment ?? "" })),
    viewer: {
      signedIn: !!viewer.userId,
      rsn: viewer.rsn,
      clanMember: viewer.clanMember,
      isStaff: viewer.isStaff,
      canSubmit: submit.ok,
      submitReason: submit.reason ?? null,
      entriesLeft: Math.max(0, contest.max_entries_per_person - mine.filter((e) => e.status !== "rejected").length),
      canVote: "key" in voter,
      voteReason: "error" in voter ? voter.error : null,
    },
  });
}
