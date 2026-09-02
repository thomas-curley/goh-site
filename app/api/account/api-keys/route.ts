import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - list the caller's own linked clients (never the plaintext token --
// only the prefix, same "show enough to tell keys apart, not enough to
// reuse" idea as a masked card number). Keys are only ever minted by the
// plugin pairing flow now (lib/plugin-link.ts); the manual "generate a key"
// path was removed once pairing existed, so this route is read-only apart
// from revocation in [id]/route.ts.
export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, label, token_prefix, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load keys." }, { status: 500 });

  return NextResponse.json({ keys: data ?? [] });
}
