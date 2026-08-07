import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// PATCH - the "I'm just a guest" path off the onboarding prompt. Only ever
// sets onboarding_skipped on the caller's own row.
export async function PATCH() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await supabase
    .from("user_profiles")
    .update({ onboarding_skipped: true, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });

  return NextResponse.json({ updated: true });
}
