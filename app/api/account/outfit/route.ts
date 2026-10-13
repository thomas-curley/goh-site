import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getDefaultOutfit, getUserOutfit } from "@/lib/profile-outfits";
import { sanitizeOutfit } from "@/lib/profiles-format";

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

// GET - the signed-in member's own outfit, plus the clan default it falls back to.
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to set your outfit." }, { status: 401 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const [outfit, defaultOutfit] = await Promise.all([getUserOutfit(supabase, userId), getDefaultOutfit(supabase)]);
  return NextResponse.json({ outfit, defaultOutfit });
}

// PUT - replace the signed-in member's outfit ({} goes back to the clan default).
export async function PUT(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to set your outfit." }, { status: 401 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const { error } = await supabase
    .from("profile_outfits")
    .upsert({ user_id: userId, items: sanitizeOutfit(body.outfit), updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Failed to save your outfit." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
