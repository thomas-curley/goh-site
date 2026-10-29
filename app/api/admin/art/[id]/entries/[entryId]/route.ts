import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { ART_BUCKET, artServiceClient } from "@/lib/art-server";

// PATCH - review an entry.
//   { action: "approve" }          it goes to the vote
//   { action: "reject", note }     sent back with a reason the artist sees
//   { action: "reopen" }           back to waiting for review
//   { gallery_hidden: bool }       keep it out of (or back in) the gallery
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  const { allowed, user } = await checkPermission("manage_art");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("gallery_hidden" in body) update.gallery_hidden = !!body.gallery_hidden;
  if ("action" in body) {
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
    if (body.action === "approve") Object.assign(update, { status: "approved", review_note: note, reviewed_by: user?.discord_username ?? null, reviewed_at: new Date().toISOString() });
    else if (body.action === "reject") {
      if (!note) return NextResponse.json({ error: "Say why, so the artist knows what to change." }, { status: 400 });
      Object.assign(update, { status: "rejected", review_note: note, reviewed_by: user?.discord_username ?? null, reviewed_at: new Date().toISOString() });
    } else if (body.action === "reopen") Object.assign(update, { status: "pending", review_note: null, reviewed_by: null, reviewed_at: null });
    else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  const { error } = await supabase.from("art_entries").update(update).eq("id", entryId).eq("contest_id", id);
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ saved: true });
}

// DELETE - remove an entry (and its votes and images) for good.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  const { allowed } = await checkPermission("manage_art");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const { data: entry } = await supabase.from("art_entries").select("image_paths").eq("id", entryId).eq("contest_id", id).maybeSingle();
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  if (entry.image_paths?.length) await supabase.storage.from(ART_BUCKET).remove(entry.image_paths);
  await supabase.from("art_entries").delete().eq("id", entryId);
  return NextResponse.json({ deleted: true });
}
