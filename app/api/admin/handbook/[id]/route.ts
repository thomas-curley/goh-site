import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_TITLE_LENGTH = 200;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

// PATCH - edit any field of a section.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_handbook");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
    if (!title) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    update.title = title;
  }
  if (body.slug !== undefined) {
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!slug || !SLUG_PATTERN.test(slug)) {
      return NextResponse.json({ error: "Slug can only contain lowercase letters, numbers, and hyphens." }, { status: 400 });
    }
    update.slug = slug;
  }
  if (body.parent_slug !== undefined) update.parent_slug = body.parent_slug || null;
  if (body.order_index !== undefined) update.order_index = Number.isFinite(body.order_index) ? body.order_index : 0;
  if (body.pull_quote !== undefined) update.pull_quote = typeof body.pull_quote === "string" ? body.pull_quote.trim() || null : null;
  if (body.banner_image_url !== undefined) update.banner_image_url = typeof body.banner_image_url === "string" ? body.banner_image_url.trim() || null : null;
  if (body.content !== undefined) update.content = typeof body.content === "string" ? body.content : "";
  if (body.visibility !== undefined) {
    if (!["anonymous", "verified_player", "clan_member", "staff"].includes(body.visibility)) {
      return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });
    }
    update.visibility = body.visibility;
  }
  if (body.is_published !== undefined) update.is_published = !!body.is_published;

  const { data, error } = await supabase
    .from("handbook_sections")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That slug is already in use." }, { status: 409 });
    return NextResponse.json({ error: "Failed to update section." }, { status: 500 });
  }

  return NextResponse.json({ section: data });
}

// DELETE - remove a section. Cascades to any subsections (parent_slug FK is ON DELETE CASCADE).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_handbook");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await supabase.from("handbook_sections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete section." }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
