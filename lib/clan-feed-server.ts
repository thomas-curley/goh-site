import type { SupabaseClient } from "@supabase/supabase-js";
import { createFeedSubmission, findTeamFor, loadBingoBundle, storeRemoteImages, type BingoBundle } from "@/lib/bingo-server";
import { loadQuestBundle, recordCompletion, type QuestBundle } from "@/lib/quest-server";
import { eventQuests } from "@/lib/quests";
import { feedText, matchQuest, nameKey, parseFeedMessage, rsnKey, type FeedEvent, type FeedMessage } from "@/lib/clan-feed";

// Applies clan feed posts (see lib/clan-feed.ts) to what's running: quest
// completions count for quest event players, drops tick bingo item tiles.

export interface FeedOutcome {
  /** What it was checked against. */
  target: "quest_event" | "bingo";
  eventId: string;
  eventName: string;
  rsn: string;
  name: string;
  /** e.g. "counted", "queued", "not in this event", "doesn't count here". */
  result: string;
  tileTitle?: string;
}

const KEEP_DAYS = 30;

function within(at: number, startsAt: string | null, endsAt: string | null): boolean {
  return (!startsAt || Date.parse(startsAt) <= at) && (!endsAt || Date.parse(endsAt) > at);
}

/** Live quest events and bingos, loaded once per post. */
async function liveEvents(supabase: SupabaseClient): Promise<{ quests: QuestBundle[]; bingos: BingoBundle[] }> {
  const [{ data: q }, { data: b }] = await Promise.all([
    supabase.from("quest_events").select("id").eq("status", "active"),
    supabase.from("bingo_events").select("id").eq("status", "active"),
  ]);
  const quests = (await Promise.all((q ?? []).map((e) => loadQuestBundle(supabase, e.id)))).filter((x): x is QuestBundle => !!x);
  const bingos = (await Promise.all((b ?? []).map((e) => loadBingoBundle(supabase, e.id)))).filter((x): x is BingoBundle => !!x);
  return { quests, bingos };
}

/**
 * Works out what each event in a post counts for, and (unless `dryRun`)
 * records it. Images are only copied into storage when something counts.
 */
export async function applyFeedEvents(
  supabase: SupabaseClient,
  events: FeedEvent[],
  postedAt: string,
  imageUrls: string[],
  { dryRun = false } = {}
): Promise<FeedOutcome[]> {
  if (events.length === 0) return [];
  const at = Date.parse(postedAt);
  const { quests, bingos } = await liveEvents(supabase);
  const outcomes: FeedOutcome[] = [];
  let stored: string[] | null = null;
  const images = async () => (stored ??= dryRun ? [] : await storeRemoteImages(supabase, imageUrls));

  for (const ev of events) {
    if (ev.kind === "quest") {
      const quest = matchQuest(ev.name);
      for (const bundle of quests) {
        const base = { target: "quest_event" as const, eventId: bundle.event.id, eventName: bundle.event.name, rsn: ev.rsn, name: quest ?? ev.name };
        const player = bundle.participants.find((p) => rsnKey(p.rsn) === rsnKey(ev.rsn));
        if (!player) {
          outcomes.push({ ...base, result: "not in this event" });
          continue;
        }
        if (!quest) {
          outcomes.push({ ...base, result: "quest name not recognised" });
          continue;
        }
        if (!within(at, bundle.event.starts_at, bundle.event.ends_at)) {
          outcomes.push({ ...base, result: "outside the event's dates" });
          continue;
        }
        if (!eventQuests(bundle.event).some((q) => q.name === quest)) {
          outcomes.push({ ...base, result: "doesn't count in this event" });
          continue;
        }
        if (bundle.completions.some((c) => c.participant_id === player.id && c.quest_name === quest)) {
          outcomes.push({ ...base, result: "already counted" });
          continue;
        }
        const added = dryRun || (await recordCompletion(supabase, bundle, player, quest, "broadcast", await images(), postedAt));
        outcomes.push({ ...base, result: added ? "counted" : "already counted" });
      }
      continue;
    }

    // Drops, collection log items and pets: bingo item tiles.
    const key = nameKey(ev.name);
    for (const bundle of bingos) {
      if (bundle.event.feed_mode === "off") continue;
      const tiles = bundle.tiles.filter((t) => t.kind === "proof" && t.accepted_items.some((i) => nameKey(i) === key));
      if (tiles.length === 0) continue;
      const base = { target: "bingo" as const, eventId: bundle.event.id, eventName: bundle.event.name, rsn: ev.rsn, name: ev.name };
      const team = findTeamFor(bundle.teams, [ev.rsn]);
      if (!team) {
        outcomes.push({ ...base, result: "not on a team" });
        continue;
      }
      if (!within(at, bundle.event.starts_at, bundle.event.ends_at)) {
        outcomes.push({ ...base, result: "outside the event's dates" });
        continue;
      }
      for (const tile of tiles) {
        const result = await createFeedSubmission(supabase, bundle, {
          tile,
          teamId: team.teamId,
          rsn: team.rsn,
          item: ev.name,
          quantity: ev.quantity,
          imageUrls: dryRun ? [] : await images(),
          postedAt,
          dryRun,
        });
        outcomes.push({ ...base, rsn: team.rsn, tileTitle: tile.title, result });
      }
    }
  }
  return outcomes;
}

/**
 * Reads one feed post. A post seen before is only looked at again if
 * nothing came of it the first time (bots sometimes fill in an embed by
 * editing their message).
 */
export async function ingestFeedMessage(supabase: SupabaseClient, msg: FeedMessage): Promise<{ events: FeedEvent[]; outcomes: FeedOutcome[]; skipped?: boolean }> {
  const { data: seen } = await supabase.from("clan_feed_messages").select("id, events").eq("discord_message_id", msg.messageId).maybeSingle();
  if (seen && Array.isArray(seen.events) && seen.events.length > 0) return { events: seen.events as FeedEvent[], outcomes: [], skipped: true };

  const events = parseFeedMessage(msg);
  const imageUrls = [...msg.embeds.map((e) => e.imageUrl).filter((u): u is string => !!u), ...msg.attachmentUrls];
  const outcomes = await applyFeedEvents(supabase, events, msg.postedAt, imageUrls);
  const row = {
    discord_message_id: msg.messageId,
    channel_id: msg.channelId,
    author_name: msg.authorName,
    posted_at: msg.postedAt,
    text: feedText(msg),
    image_urls: imageUrls.slice(0, 4),
    events,
    outcomes,
  };
  if (seen) await supabase.from("clan_feed_messages").update(row).eq("id", seen.id);
  else await supabase.from("clan_feed_messages").insert(row);
  await supabase.from("clan_feed_messages").delete().lt("posted_at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
  return { events, outcomes };
}
