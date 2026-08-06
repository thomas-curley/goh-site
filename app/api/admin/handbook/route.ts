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

// GET - every section, including unpublished ones, for the admin editor.
export async function GET() {
  const { allowed } = await checkPermission("manage_handbook");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("handbook_sections")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: "Failed to load handbook sections." }, { status: 500 });

  return NextResponse.json({ sections: data ?? [] });
}

// POST - create a new section.
export async function POST(request: NextRequest) {
  const { allowed } = await checkPermission("manage_handbook");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";

  if (!title || !slug) {
    return NextResponse.json({ error: "Title and slug are required." }, { status: 400 });
  }
  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ error: "Slug can only contain lowercase letters, numbers, and hyphens." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("handbook_sections")
    .insert({
      title,
      slug,
      parent_slug: body.parent_slug || null,
      order_index: Number.isFinite(body.order_index) ? body.order_index : 0,
      pull_quote: typeof body.pull_quote === "string" ? body.pull_quote.trim() || null : null,
      banner_image_url: typeof body.banner_image_url === "string" ? body.banner_image_url.trim() || null : null,
      content: typeof body.content === "string" ? body.content : "",
      visibility: ["anonymous", "verified_player", "clan_member", "staff"].includes(body.visibility) ? body.visibility : "staff",
      is_published: body.is_published !== false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That slug is already in use." }, { status: 409 });
    return NextResponse.json({ error: "Failed to create section." }, { status: 500 });
  }

  return NextResponse.json({ section: data }, { status: 201 });
}
