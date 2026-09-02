import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { secretMatches, mintApiKey } from "@/lib/plugin-link";
import { getRequestIp, isIpBanned } from "@/lib/ip-ban";
import { layeredRateLimit } from "@/lib/rate-limit";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * GET /api/plugin/link/poll?code=... -- step 3 of pairing, polled by the
 * plugin every few seconds after the member's been sent to the approval
 * page. Authenticated by the client secret from step 1 (X-Client-Secret
 * header), so a code alone can't be redeemed by anyone else.
 *
 * Once the member has approved, the very first successful poll mints the
 * api_keys token and returns it -- the only time the plaintext ever
 * exists on the wire -- and marks the code consumed. Every later poll
 * reports "consumed", so a replay can never yield a second key.
 */
export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  // Sized for legit use: one client polls every 3s for up to the 10-minute
  // code lifetime (~200 requests). Guessing is hopeless anyway (32^8 codes
  // x a ~240-bit secret), this just stops hammering.
  const ip = getRequestIp(request);
  if (await isIpBanned(supabase, ip)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const limit = await layeredRateLimit(supabase, ip, "plugin-link-poll", {
    burst: { limit: 60, windowMs: 60_000 },
    sustained: { limit: 400, windowSeconds: 600 },
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase() ?? "";
  const clientSecret = request.headers.get("x-client-secret")?.trim() ?? "";
  if (!code || !clientSecret) {
    return NextResponse.json({ error: "code and client secret are required." }, { status: 400 });
  }

  const { data: link } = await supabase
    .from("plugin_link_codes")
    .select("code, client_secret_hash, user_id, api_key_id, approved_at, expires_at")
    .eq("code", code)
    .maybeSingle();

  // Unknown code and wrong secret are indistinguishable on purpose.
  if (!link || !secretMatches(clientSecret, link.client_secret_hash)) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  if (link.api_key_id) return NextResponse.json({ status: "consumed" });
  if (new Date(link.expires_at).getTime() < Date.now()) return NextResponse.json({ status: "expired" });
  if (!link.approved_at || !link.user_id) return NextResponse.json({ status: "pending" });

  const label = `RuneLite (linked ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`;
  const minted = await mintApiKey(supabase, link.user_id, label);
  if (!minted) return NextResponse.json({ error: "Failed to issue a key." }, { status: 500 });

  // Mark consumed atomically against the not-yet-consumed state, so two
  // racing polls can't both mint a key for one approval.
  const { data: claimed } = await supabase
    .from("plugin_link_codes")
    .update({ api_key_id: minted.id })
    .eq("code", code)
    .is("api_key_id", null)
    .select("code")
    .maybeSingle();

  if (!claimed) {
    // Lost the race -- revoke the key this request minted; the other poll's key stands.
    await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", minted.id);
    return NextResponse.json({ status: "consumed" });
  }

  return NextResponse.json({ status: "approved", token: minted.token });
}
