import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateLinkCode, hashSecret, purgeExpiredLinkCodes, LINK_CODE_TTL_MS } from "@/lib/plugin-link";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MIN_SECRET_LENGTH = 16;

/**
 * POST /api/plugin/link/start -- step 1 of pairing, called by a plugin that
 * has no token yet (so deliberately unauthenticated). The plugin sends a
 * private secret it generated; only its hash is stored, and redeeming the
 * code later requires presenting that same secret. Returns the code and
 * the page the member approves it on.
 */
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret.trim() : "";
  if (clientSecret.length < MIN_SECRET_LENGTH) {
    return NextResponse.json({ error: "clientSecret is required." }, { status: 400 });
  }

  await purgeExpiredLinkCodes(supabase);

  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();

  // Codes are random from a 32-symbol alphabet; a collision on the primary
  // key is vanishingly unlikely but costs nothing to retry once.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateLinkCode();
    const { error } = await supabase
      .from("plugin_link_codes")
      .insert({ code, client_secret_hash: hashSecret(clientSecret), expires_at: expiresAt });

    if (!error) {
      const origin = new URL(request.url).origin;
      return NextResponse.json({
        code,
        expiresAt,
        linkUrl: `${origin}/plugin/link?code=${encodeURIComponent(code)}`,
      }, { status: 201 });
    }
    if (error.code !== "23505") {
      return NextResponse.json({ error: "Failed to start linking." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Failed to start linking." }, { status: 500 });
}
