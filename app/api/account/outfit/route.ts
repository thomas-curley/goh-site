import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getDefaultCharacter, getUserCharacter, saveUserCharacter } from "@/lib/profile-characters";
import { sanitizeGear, sanitizeLook } from "@/lib/osrs-character";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function currentUserId(): Promise<string | null> {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  return user?.id ?? null;
}

// GET - the signed-in member's own character (look + gear), plus the clan
// default it falls back to.
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to set your outfit." }, { status: 401 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const [character, defaultCharacter] = await Promise.all([getUserCharacter(supabase, userId), getDefaultCharacter(supabase)]);
  return NextResponse.json({ character, defaultCharacter });
}

// PUT - replace the signed-in member's character. A null look and empty gear
// go back to the clan default.
export async function PUT(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to set your outfit." }, { status: 401 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const character = body.character ?? {};
  const { error } = await saveUserCharacter(supabase, userId, {
    look: sanitizeLook(character.look),
    gear: sanitizeGear(character.gear),
  });
  if (error) return NextResponse.json({ error: "Failed to save your outfit." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
