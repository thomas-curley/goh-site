import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/plugin/link/approve -- step 2 of pairing: the signed-in member
 * (browser cookie session, never a plugin token) approves a code shown on
 * the /plugin/link page, binding it to their account. The plugin's next
 * poll then receives its key. Approval is the only step that needs a
 * human; the code carries no identity until this happens.
 */
export async function POST(request: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return NextResponse.json({ error: "Enter the code shown in RuneLite." }, { status: 400 });

  const { data: link } = await supabase
    .from("plugin_link_codes")
    .select("code, user_id, api_key_id, approved_at, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!link) return NextResponse.json({ error: "That code isn't valid. Start linking again from RuneLite." }, { status: 404 });
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "That code has expired. Start linking again from RuneLite." }, { status: 410 });
  }
  if (link.api_key_id) return NextResponse.json({ error: "That code has already been used." }, { status: 409 });
  if (link.approved_at && link.user_id !== user.id) {
    return NextResponse.json({ error: "That code was already approved by another account." }, { status: 409 });
  }

  const { error } = await supabase
    .from("plugin_link_codes")
    .update({ user_id: user.id, approved_at: new Date().toISOString() })
    .eq("code", code)
    .is("api_key_id", null);

  if (error) return NextResponse.json({ error: "Failed to approve." }, { status: 500 });

  return NextResponse.json({ approved: true });
}
