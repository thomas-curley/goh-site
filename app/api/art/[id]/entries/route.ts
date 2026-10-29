import { NextRequest, NextResponse } from "next/server";
import { artServiceClient, canSubmit, getArtViewer, loadContest, ownPaths, readEntryFields } from "@/lib/art-server";


// POST - enter the contest: title, description, images (uploaded first via
// /upload) and the artist's privacy choices. Waits for staff review.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const [contest, viewer] = await Promise.all([loadContest(supabase, id), getArtViewer(supabase)]);
  if (!contest) return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  const allowed = canSubmit(contest, viewer);
  if (!allowed.ok || !viewer.userId) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const { count } = await supabase.from("art_entries").select("*", { count: "exact", head: true }).eq("contest_id", id).eq("user_id", viewer.userId).in("status", ["pending", "approved"]);
  if ((count ?? 0) >= contest.max_entries_per_person) {
    return NextResponse.json({ error: contest.max_entries_per_person === 1 ? "You've already entered this contest. You can edit your entry instead." : `You can enter up to ${contest.max_entries_per_person} pieces.` }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const fields = readEntryFields(body);
  if (!fields.title) return NextResponse.json({ error: "Give your piece a title." }, { status: 400 });
  if (fields.credit === "custom" && !fields.credit_name) return NextResponse.json({ error: "Type the name you'd like to be credited as." }, { status: 400 });
  if (!body.agreed_rules) return NextResponse.json({ error: "Please confirm the piece follows the contest rules." }, { status: 400 });
  const image_paths = ownPaths(body.image_paths, id, viewer.userId, contest.max_images_per_entry);
  if (image_paths.length === 0) return NextResponse.json({ error: "Add at least one image of your piece." }, { status: 400 });

  const { data, error } = await supabase
    .from("art_entries")
    .insert({ ...fields, contest_id: id, user_id: viewer.userId, rsn: viewer.verified ? viewer.rsn : null, image_paths, agreed_rules: true, status: "pending" })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "Couldn't save your entry." }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
