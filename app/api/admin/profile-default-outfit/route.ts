import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { getDefaultOutfit, saveDefaultOutfit } from "@/lib/profile-outfits";
import { sanitizeOutfit } from "@/lib/profiles-format";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET / PUT - the clan's default outfit (the gnome fashionscape), used for
// any profile slot a member hasn't set.
export async function GET() {
  const { allowed } = await checkPermission("manage_member_profiles");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  return NextResponse.json({ outfit: await getDefaultOutfit(supabase) });
}

export async function PUT(request: NextRequest) {
  const { allowed } = await checkPermission("manage_member_profiles");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const { error } = await saveDefaultOutfit(supabase, sanitizeOutfit(body.outfit));
  if (error) return NextResponse.json({ error: "Failed to save the default outfit." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
