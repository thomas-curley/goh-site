import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { SITE_SECTIONS } from "@/lib/site-sections";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const VALID_KEYS = new Set<string>(SITE_SECTIONS.map((s) => s.key));
const VALID_ROLES = new Set<string>(ASSIGNABLE_ROLES.map((r) => r.key));

// GET - every (role, section) visibility override.
export async function GET() {
  const { allowed } = await checkPermission("manage_sections");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("section_visibility").select("*");
  if (error) return NextResponse.json({ error: "Failed to load section visibility." }, { status: 500 });

  return NextResponse.json({ visibility: data ?? [] });
}

// PATCH - upsert one (role, section) visibility override.
export async function PATCH(request: NextRequest) {
  const { allowed } = await checkPermission("manage_sections");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const role = typeof body.role === "string" ? body.role : "";
  const sectionKey = typeof body.sectionKey === "string" ? body.sectionKey : "";
  if (!VALID_ROLES.has(role)) return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  if (!VALID_KEYS.has(sectionKey)) return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  if (typeof body.visible !== "boolean") return NextResponse.json({ error: "visible must be a boolean." }, { status: 400 });

  const { error } = await supabase.from("section_visibility").upsert(
    {
      role,
      section_key: sectionKey,
      visible: body.visible,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "role,section_key" }
  );

  if (error) return NextResponse.json({ error: "Failed to update section visibility." }, { status: 500 });
  return NextResponse.json({ success: true });
}
