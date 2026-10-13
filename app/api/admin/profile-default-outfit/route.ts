import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { getDefaultCharacter, saveDefaultCharacter } from "@/lib/profile-characters";
import { defaultLook, sanitizeGear, sanitizeLook } from "@/lib/osrs-character";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET / PUT - the clan's default character (the gnome fashionscape), used
// for any part of a profile character a member hasn't set.
export async function GET() {
  const { allowed } = await checkPermission("manage_member_profiles");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  return NextResponse.json({ character: await getDefaultCharacter(supabase) });
}

export async function PUT(request: NextRequest) {
  const { allowed } = await checkPermission("manage_member_profiles");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const character = body.character ?? {};
  const { error } = await saveDefaultCharacter(supabase, {
    look: sanitizeLook(character.look) ?? defaultLook(),
    gear: sanitizeGear(character.gear),
  });
  if (error) return NextResponse.json({ error: "Failed to save the default outfit." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
