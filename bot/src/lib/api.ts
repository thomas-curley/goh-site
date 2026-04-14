/**
 * Client for the Gn0me Home website API.
 * Uses the same DISCORD_WEBHOOK_SECRET for auth.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SECRET = process.env.DISCORD_WEBHOOK_SECRET ?? "";

async function apiCall(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
      ...options.headers,
    },
  });
  return res;
}

/** Look up a user's linked RSN by Discord ID */
export async function lookupUser(discordId: string) {
  const res = await apiCall(`/api/users/lookup?discord_id=${discordId}`);
  if (!res.ok) return null;
  return res.json() as Promise<{
    discord_id: string;
    discord_username: string;
    rsn: string | null;
    rsn_verified: boolean;
    clan_rank: string | null;
  }>;
}

/** Look up by RSN */
export async function lookupByRsn(rsn: string) {
  const res = await apiCall(`/api/users/lookup?rsn=${encodeURIComponent(rsn)}`);
  if (!res.ok) return null;
  return res.json();
}

/** Get linked RSN for a Discord user, or return null */
export async function getLinkedRsn(discordId: string): Promise<string | null> {
  const user = await lookupUser(discordId);
  return user?.rsn ?? null;
}
