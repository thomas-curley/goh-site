import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { getServiceClient, parseNewsletterBody } from "@/lib/newsletter-admin";

// PATCH - edit an issue (any subset of fields, including publish/unpublish).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await checkPermission("manage_newsletter");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const { id } = await params;

  const parsed = parseNewsletterBody(await request.json().catch(() => ({})), true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Publishing an issue saved without pages (or clearing the pages of a
  // published one) would leave an empty page on the site.
  if (parsed.update.is_published === true || Array.isArray(parsed.update.page_urls)) {
    const { data: current } = await supabase.from("newsletters").select("page_urls, is_published").eq("id", id).maybeSingle();
    const pages = (parsed.update.page_urls as string[] | undefined) ?? current?.page_urls ?? [];
    const published = (parsed.update.is_published as boolean | undefined) ?? current?.is_published ?? false;
    if (published && pages.length === 0) return NextResponse.json({ error: "Add at least one page before publishing." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("newsletters")
    .update({ ...parsed.update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "That issue number already exists." : "Failed to save the issue." }, { status: duplicate ? 409 : 500 });
  }
  if (!data) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  return NextResponse.json({ newsletter: data });
}

// DELETE - remove an issue (its uploaded files stay in storage).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await checkPermission("manage_newsletter");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const { id } = await params;

  const { error } = await supabase.from("newsletters").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete the issue." }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
