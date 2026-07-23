import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - the caller's own most recent staff application, so /apply can show
// a status card instead of the form when one is already pending.
export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("discord_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.discord_id) {
    return NextResponse.json({ application: null });
  }

  const { data: application } = await supabase
    .from("staff_applications")
    .select("*")
    .eq("discord_id", profile.discord_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ application: application ?? null });
}
