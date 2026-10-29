import { NextRequest, NextResponse } from "next/server";
import { ART_IMAGE_TYPES, artServiceClient, canSubmit, createUploadSlot, getArtViewer, loadContest } from "@/lib/art-server";

// POST { contentType } - a one-time link to upload one image of an entry
// straight to private storage (so big files skip the site's request limit).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const [contest, viewer] = await Promise.all([loadContest(supabase, id), getArtViewer(supabase)]);
  if (!contest) return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  const allowed = canSubmit(contest, viewer);
  if (!allowed.ok || !viewer.userId) return NextResponse.json({ error: allowed.reason }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!ART_IMAGE_TYPES.includes(body.contentType)) return NextResponse.json({ error: "Use a PNG, JPG, WebP or GIF image." }, { status: 400 });
  const slot = await createUploadSlot(supabase, id, viewer.userId, body.contentType);
  if (!slot) return NextResponse.json({ error: "Couldn't prepare the upload. Try again." }, { status: 500 });
  return NextResponse.json(slot);
}
