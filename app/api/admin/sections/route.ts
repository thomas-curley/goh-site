import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { SITE_SECTIONS, type SiteSectionKey } from "@/lib/site-sections";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const VALID_KEYS = new Set<string>(SITE_SECTIONS.map((s) => s.key));

// GET - current staff_only override for every registered section.
export async function GET() {
  const { allowed } = await checkPermission("manage_sections");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("site_sections").select("*");
  if (error) return NextResponse.json({ error: "Failed to load sections." }, { status: 500 });

  return NextResponse.json({ sections: data ?? [] });
}

// PATCH - upsert one section's staff_only override.
export async function PATCH(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_sections");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const key = typeof body.key === "string" ? body.key : "";
  if (!VALID_KEYS.has(key)) return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  if (typeof body.staffOnly !== "boolean") return NextResponse.json({ error: "staffOnly must be a boolean." }, { status: 400 });

  const { error } = await supabase.from("site_sections").upsert(
    {
      key: key as SiteSectionKey,
      staff_only: body.staffOnly,
      updated_by: user?.discord_username ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) return NextResponse.json({ error: "Failed to update section." }, { status: 500 });
  return NextResponse.json({ success: true });
}
