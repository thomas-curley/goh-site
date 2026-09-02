import { createHash, randomBytes, randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Pairing codes expire quickly -- they're meant to be approved within the minute. */
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;

// No 0/O/1/I -- the member may read this off a game-client panel and type
// nothing, but it's also shown on the approval page, so keep it unambiguous.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateLinkCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Constant-time compare of two hex digests, so a mismatch can't be timed. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Mints a real api_keys row for the user -- identical to what the Account
 * page's "Generate New Key" does (see /api/account/api-keys), so a linked
 * client shows up in that list and can be revoked there like any other key.
 * Returns the plaintext token exactly once; only its hash is persisted.
 */
export async function mintApiKey(supabase: SupabaseClient, userId: string, label: string): Promise<{ id: string; token: string } | null> {
  const token = `gohpat_${randomBytes(32).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenPrefix = token.slice(0, 8 + "gohpat_".length);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({ user_id: userId, label, token_hash: tokenHash, token_prefix: tokenPrefix })
    .select("id")
    .single();

  if (error || !data) return null;
  return { id: data.id, token };
}

/** Opportunistic cleanup so the table never accumulates dead codes. */
export async function purgeExpiredLinkCodes(supabase: SupabaseClient): Promise<void> {
  await supabase.from("plugin_link_codes").delete().lt("expires_at", new Date().toISOString());
}
