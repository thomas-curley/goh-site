import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { getServiceClient, parseEditionBody } from "@/lib/handbook-editions";
import { HANDBOOK_BUCKET } from "@/lib/handbook-format";

// PATCH - edit an edition: any subset of fields, publish/unpublish, or
// `makeCurrent` to re-publish an older edition as the current handbook.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await checkPermission("manage_handbook");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const { id } = await params;

  const { data: current } = await supabase.from("handbook_editions").select("page_paths, is_published, published_at").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Edition not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseEditionBody(body, true, current.page_paths.length);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { update } = parsed;

  const pages = (update.page_paths as string[] | undefined) ?? current.page_paths;
  const published = (update.is_published as boolean | undefined) ?? current.is_published;
  if (published && pages.length === 0) return NextResponse.json({ error: "Add at least one page before publishing." }, { status: 400 });
  // The newest published_at is the current handbook.
  if (published && (!current.published_at || body.makeCurrent === true)) update.published_at = new Date().toISOString();

  const { error } = await supabase
    .from("handbook_editions")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to save the handbook." }, { status: 500 });
  return NextResponse.json({ saved: true });
}

// DELETE - remove an edition and its uploaded files.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await checkPermission("manage_handbook");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const { id } = await params;

  const { data: row } = await supabase.from("handbook_editions").select("page_paths, pdf_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("handbook_editions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete the edition." }, { status: 500 });

  const files = row ? [...row.page_paths, ...(row.pdf_path ? [row.pdf_path] : [])] : [];
  if (files.length > 0) await supabase.storage.from(HANDBOOK_BUCKET).remove(files);
  return NextResponse.json({ deleted: true });
}
