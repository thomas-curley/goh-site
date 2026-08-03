import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - every profile, including hidden/unpublished ones, for moderation.
export async function GET() {
  const { allowed } = await checkPermission("manage_member_profiles");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("member_profiles")
    .select("*, user_profiles!inner(discord_username, discord_avatar, rsn, clan_rank)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load profiles." }, { status: 500 });

  return NextResponse.json({ profiles: data ?? [] });
}
