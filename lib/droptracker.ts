import type { SupabaseClient } from "@supabase/supabase-js";
import { applyFeedEvents, liveEvents, type FeedOutcome } from "@/lib/clan-feed-server";
import type { FeedEvent } from "@/lib/clan-feed";

// DropTracker's Data API (https://www.droptracker.io/docs/api): the group's
// drop feed, polled while a bingo is listening for drops. Each drop goes
// through the same matching as the Discord clan feed and is logged in the
// same place (Admin › Clan Feed), keyed by DropTracker's drop_id so a drop
// is only ever counted once. Quests aren't in the API's feed (it only has
// counts), so those still come from the Discord embed and WikiSync.

const BASE = "https://api.droptracker.io/v2";
export const DROPTRACKER_CHANNEL = "droptracker-api";
const MAX_WINDOW_S = 7 * 86_400; // the API's limit for a drops window
const DEFAULT_WINDOW_S = 6 * 3600; // first poll, or after a long gap we can't place

export function droptrackerConfigured(): boolean {
  return !!process.env.DROPTRACKER_API_KEY;
}

async function dt(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${process.env.DROPTRACKER_API_KEY}` }, cache: "no-store" });
}

/** Finds a group id anywhere in /v2/meta's scope (shape varies by key type). */
function findGroupId(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "group_id" && (typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v)))) return Number(v);
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    const found = findGroupId(v);
    if (found) return found;
  }
  return null;
}

export interface DroptrackerStatus {
  configured: boolean;
  ok: boolean;
  groupId: number | null;
  scope: unknown;
  error?: string;
}

/** The key's scope and group, from GET /v2/meta. DROPTRACKER_GROUP_ID overrides the group. */
export async function droptrackerStatus(): Promise<DroptrackerStatus> {
  if (!droptrackerConfigured()) return { configured: false, ok: false, groupId: null, scope: null };
  const res = await dt("/meta").catch(() => null);
  if (!res?.ok) return { configured: true, ok: false, groupId: null, scope: null, error: res ? `DropTracker said ${res.status}` : "Couldn't reach DropTracker" };
  const meta = await res.json().catch(() => ({}));
  const override = Number(process.env.DROPTRACKER_GROUP_ID);
  return { configured: true, ok: true, groupId: override || findGroupId(meta?.scope) || findGroupId(meta), scope: meta?.scope ?? null };
}

interface ApiDrop {
  item_id?: number;
  item_name?: string;
  npc_name?: string;
  quantity?: number;
  total_value?: number;
  received_at?: number;
  drop_id?: number;
}
interface ApiPlayer {
  identity?: { name?: string; display_name?: string; rsn?: string };
  name?: string;
  drops?: { drops?: ApiDrop[]; truncated?: boolean } | { error: string };
}

function playerName(p: ApiPlayer): string | null {
  const id = (p.identity ?? {}) as Record<string, unknown>;
  for (const v of [id.display_name, id.player_name, id.name, id.rsn, (p as Record<string, unknown>).player_name, p.name]) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Bingos listening for feed drops right now (live, not set to ignore). */
async function wantsDrops(supabase: SupabaseClient): Promise<boolean> {
  const { count } = await supabase.from("bingo_events").select("*", { count: "exact", head: true }).eq("status", "active").neq("feed_mode", "off");
  return (count ?? 0) > 0;
}

export interface PollResult {
  skipped?: string;
  players: number;
  drops: number;
  newDrops: number;
  counted: number;
  truncated: string[];
  error?: string;
}

/**
 * Reads the group's drops since shortly before the last one we stored (up
 * to 7 days back) and applies the new ones. Skips when no bingo is live,
 * since every poll costs the group's whole roster in API budget.
 */
export async function pollDroptracker(supabase: SupabaseClient, { force = false } = {}): Promise<PollResult> {
  const empty: PollResult = { players: 0, drops: 0, newDrops: 0, counted: 0, truncated: [] };
  if (!droptrackerConfigured()) return { ...empty, skipped: "no API key" };
  if (!force && !(await wantsDrops(supabase))) return { ...empty, skipped: "no bingo is live" };
  const status = await droptrackerStatus();
  if (!status.ok || !status.groupId) {
    const failed = { ...empty, error: status.error ?? "Couldn't tell which DropTracker group the key belongs to. Set DROPTRACKER_GROUP_ID in Vercel." };
    await supabase.from("clan_feed_sources").upsert({ source: DROPTRACKER_CHANNEL, last_result: { ...failed, at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "source" });
    return failed;
  }

  const now = Math.floor(Date.now() / 1000);
  const { data: state } = await supabase.from("clan_feed_sources").select("last_polled_at").eq("source", DROPTRACKER_CHANNEL).maybeSingle();
  const lastPoll = state?.last_polled_at ? Math.floor(Date.parse(state.last_polled_at) / 1000) : null;
  // Overlap the previous poll by 10 minutes; drop_id makes the overlap harmless.
  const since = Math.max(now - MAX_WINDOW_S + 60, lastPoll ? lastPoll - 600 : now - DEFAULT_WINDOW_S);
  const record = (r: PollResult, polled: boolean) =>
    supabase.from("clan_feed_sources").upsert(
      { source: DROPTRACKER_CHANNEL, ...(polled ? { last_polled_at: new Date(now * 1000).toISOString() } : {}), last_result: { ...r, at: new Date().toISOString() }, updated_at: new Date().toISOString() },
      { onConflict: "source" }
    );

  const result: PollResult = { ...empty };
  let live: Awaited<ReturnType<typeof liveEvents>> | null = null;
  let cursor = "";
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ include: "identity,drops,drop_ids", limit: "100", since: String(since), until: String(now), max_drops: "200" });
    if (cursor) qs.set("cursor", cursor);
    const res = await dt(`/groups/${status.groupId}/players?${qs}`).catch(() => null);
    if (!res?.ok) {
      const failed = { ...result, error: res ? `DropTracker said ${res.status}${res.status === 429 ? " (rate limited, will retry next time)" : ""}` : "Couldn't reach DropTracker" };
      await record(failed, false);
      return failed;
    }
    const body = (await res.json().catch(() => ({}))) as { players?: ApiPlayer[]; next_cursor?: string | null };
    for (const p of body.players ?? []) {
      result.players++;
      const rsn = playerName(p);
      const feed = p.drops && "drops" in p.drops ? p.drops : null;
      if (!rsn || !feed?.drops?.length) continue;
      if (feed.truncated) result.truncated.push(rsn);
      for (const d of feed.drops) {
        result.drops++;
        if (!d.drop_id || !d.item_name || !d.received_at) continue;
        const messageId = `dt-${d.drop_id}`;
        const { data: seen } = await supabase.from("clan_feed_messages").select("id").eq("discord_message_id", messageId).maybeSingle();
        if (seen) continue;
        result.newDrops++;
        const postedAt = new Date(d.received_at * 1000).toISOString();
        const events: FeedEvent[] = [{ kind: "drop", rsn, name: d.item_name, quantity: Math.max(1, d.quantity ?? 1) }];
        live ??= await liveEvents(supabase);
        const outcomes: FeedOutcome[] = await applyFeedEvents(supabase, events, postedAt, [], { live });
        result.counted += outcomes.filter((o) => o.result === "counted" || o.result === "queued").length;
        await supabase.from("clan_feed_messages").insert({
          discord_message_id: messageId,
          channel_id: DROPTRACKER_CHANNEL,
          author_name: "DropTracker API",
          posted_at: postedAt,
          text: `${rsn} received ${(d.quantity ?? 1) > 1 ? `${d.quantity} x ` : ""}${d.item_name}${d.npc_name ? ` from ${d.npc_name}` : ""}`,
          events,
          outcomes,
        });
      }
    }
    cursor = body.next_cursor ?? "";
    if (!cursor) break;
  }
  await record(result, true);
  return result;
}
