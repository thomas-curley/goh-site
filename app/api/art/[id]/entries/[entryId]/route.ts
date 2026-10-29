import { NextRequest, NextResponse } from "next/server";
import { ART_BUCKET, artServiceClient, getArtViewer, loadContest, ownPaths, readEntryFields } from "@/lib/art-server";

async function own(id: string, entryId: string) {
  const supabase = artServiceClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  const [contest, viewer] = await Promise.all([loadContest(supabase, id), getArtViewer(supabase)]);
  if (!contest || !viewer.userId) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  const { data: entry } = await supabase.from("art_entries").select("id, user_id, status, image_paths").eq("id", entryId).eq("contest_id", id).maybeSingle();
  if (!entry || entry.user_id !== viewer.userId) return { error: NextResponse.json({ error: "Entry not found." }, { status: 404 }) };
  return { supabase, contest, viewer, entry };
}

// PATCH - edit your entry while entries are open. Its privacy choices
// (credit, clan-only, gallery) can be changed at any time; editing the
// piece itself sends it back for review.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  const ctx = await own(id, entryId);
  if ("error" in ctx) return ctx.error;
  const { supabase, contest, viewer, entry } = ctx;
  const body = await request.json().catch(() => ({}));
  const fields = readEntryFields({ title: "x", ...body });
  const update: Record<string, unknown> = {
    visibility: fields.visibility,
    credit: fields.credit,
    credit_name: fields.credit_name,
    gallery_opt_in: fields.gallery_opt_in,
    updated_at: new Date().toISOString(),
  };
  if (fields.credit === "custom" && !fields.credit_name) return NextResponse.json({ error: "Type the name you'd like to be credited as." }, { status: 400 });

  const editsPiece = "title" in body || "description" in body || "image_paths" in body;
  if (editsPiece) {
    if (contest.status !== "submissions") return NextResponse.json({ error: "Entries are closed, so the piece can't be changed now. You can still change your privacy choices." }, { status: 400 });
    if (!fields.title || fields.title === "x") return NextResponse.json({ error: "Give your piece a title." }, { status: 400 });
    const paths = ownPaths(body.image_paths, id, viewer.userId!, contest.max_images_per_entry);
    if (paths.length === 0) return NextResponse.json({ error: "Add at least one image of your piece." }, { status: 400 });
    const removed = (entry.image_paths ?? []).filter((p: string) => !paths.includes(p));
    if (removed.length) await supabase.storage.from(ART_BUCKET).remove(removed);
    Object.assign(update, { title: fields.title, description: fields.description, image_paths: paths, status: "pending", review_note: null, reviewed_by: null, reviewed_at: null });
  }
  const { error } = await supabase.from("art_entries").update(update).eq("id", entryId);
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ saved: true });
}

// DELETE - withdraw your entry (removes its images; votes for it go too).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  const ctx = await own(id, entryId);
  if ("error" in ctx) return ctx.error;
  if (ctx.entry.image_paths?.length) await ctx.supabase.storage.from(ART_BUCKET).remove(ctx.entry.image_paths);
  await ctx.supabase.from("art_votes").delete().eq("entry_id", entryId);
  await ctx.supabase.from("art_entries").update({ status: "withdrawn", image_paths: [], updated_at: new Date().toISOString() }).eq("id", entryId);
  return NextResponse.json({ withdrawn: true });
}
