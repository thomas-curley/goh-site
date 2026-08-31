import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_LABEL_LENGTH = 60;

// GET - list the caller's own keys (never the plaintext token -- only the
// prefix, same "show enough to tell keys apart, not enough to reuse" idea
// as a masked card number).
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

// POST - generate a new key. The plaintext token is returned exactly once,
// here, and never again -- only its hash and an 8-char prefix are persisted.
export async function POST(request: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.trim().slice(0, MAX_LABEL_LENGTH) || null : null;

  const token = `gohpat_${randomBytes(32).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenPrefix = token.slice(0, 8 + "gohpat_".length);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({ user_id: user.id, label, token_hash: tokenHash, token_prefix: tokenPrefix })
    .select("id, label, token_prefix, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Failed to generate key." }, { status: 500 });

  return NextResponse.json({ key: data, token }, { status: 201 });
}
