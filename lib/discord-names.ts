const DISCORD_API = "https://discord.com/api/v10";

/** Channel and role names in the clan's Discord, for showing <#id> / <@&id> and channel links readably. */
export interface DiscordNames {
  channels: Record<string, string>;
  roles: Record<string, string>;
  /** Discord user id -> RSN (or Discord name) for members with a linked site account. */
  users?: Record<string, string>;
  guildId: string | null;
}

/** Names for the <@id> mentions in some Discord text, from members' linked site accounts. */
export async function getMentionNames(supabase: { from: (t: string) => any }, texts: string[]): Promise<Record<string, string>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const ids = [...new Set(texts.flatMap((t) => [...t.matchAll(/<@!?(\d+)>/g)].map((m) => m[1])))].slice(0, 100);
  if (ids.length === 0) return {};
  const { data } = await supabase.from("user_profiles").select("discord_id, rsn, discord_username").in("discord_id", ids);
  return Object.fromEntries(((data ?? []) as { discord_id: string; rsn: string | null; discord_username: string | null }[]).map((p) => [p.discord_id, p.rsn || p.discord_username || "member"]));
}

/** Looked up with the bot token and cached for an hour; empty if Discord isn't configured or reachable. */
export async function getDiscordNames(): Promise<DiscordNames> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID ?? null;
  const empty: DiscordNames = { channels: {}, roles: {}, guildId };
  if (!token || !guildId) return empty;
  const get = (path: string) =>
    fetch(`${DISCORD_API}${path}`, { headers: { Authorization: `Bot ${token}` }, next: { revalidate: 3600 } })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  const [channels, threads, roles] = await Promise.all([get(`/guilds/${guildId}/channels`), get(`/guilds/${guildId}/threads/active`), get(`/guilds/${guildId}/roles`)]);
  const byId = (list: unknown) => Object.fromEntries((Array.isArray(list) ? list : []).filter((x) => x?.id && x?.name).map((x: { id: string; name: string }) => [x.id, x.name]));
  return {
    channels: { ...byId(channels), ...byId((threads as { threads?: unknown })?.threads) },
    roles: byId(roles),
    guildId,
  };
}
