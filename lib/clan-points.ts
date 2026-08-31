import type { SupabaseClient } from "@supabase/supabase-js";
import { postToChannel } from "@/lib/discord";
import { getAlertChannel } from "@/lib/alert-channels";

export type PluginEventType = "level_up" | "quest_completion" | "boss_kc_milestone" | "clue_scroll" | "pet_drop";

export const PLUGIN_EVENT_TYPES: PluginEventType[] = [
  "level_up",
  "quest_completion",
  "boss_kc_milestone",
  "clue_scroll",
  "pet_drop",
];

// Two channels for now: routine progress vs. celebration-worthy. Splitting
// further later (e.g. per-event-type channels) is just adding a map entry
// and an alert_channels row -- never a schema change.
const EVENT_ALERT_KEYS: Record<PluginEventType, string> = {
  level_up: "plugin_activity",
  quest_completion: "plugin_activity",
  boss_kc_milestone: "plugin_activity",
  clue_scroll: "plugin_activity",
  pet_drop: "plugin_highlights",
};

interface ResolvedEvent {
  ruleKey: string;
  dedupeKey: string;
  message: string;
}

const CLUE_TIERS = ["easy", "medium", "hard", "elite", "master"];

/**
 * Derives the points-rule key, the ledger dedupe key, and the Discord
 * message for one reported event. Returns null for a malformed detail
 * payload -- the caller should respond 400.
 */
function resolveEvent(rsn: string, eventType: PluginEventType, detail: Record<string, unknown>, clientEventId?: string): ResolvedEvent | null {
  switch (eventType) {
    case "level_up": {
      const skill = typeof detail.skill === "string" ? detail.skill : null;
      const level = typeof detail.level === "number" ? detail.level : null;
      if (!skill || !level || level < 1 || level > 99) return null;
      return {
        ruleKey: level === 99 ? "level_up_99" : "level_up",
        dedupeKey: `level_up:${skill}:${level}`,
        message: level === 99
          ? `🎉 **${rsn}** just achieved level 99 **${skill}**!`
          : `📈 **${rsn}** leveled up **${skill}** to ${level}.`,
      };
    }
    case "quest_completion": {
      const questName = typeof detail.questName === "string" ? detail.questName.trim() : "";
      if (!questName) return null;
      return {
        ruleKey: "quest_completion",
        dedupeKey: `quest:${questName}`,
        message: `📜 **${rsn}** completed the quest **${questName}**!`,
      };
    }
    case "boss_kc_milestone": {
      const boss = typeof detail.boss === "string" ? detail.boss.trim() : "";
      const kc = typeof detail.kc === "number" ? detail.kc : null;
      if (!boss || !kc || kc < 1) return null;
      return {
        ruleKey: "boss_kc_milestone",
        dedupeKey: `kc:${boss}:${kc}`,
        message: `⚔️ **${rsn}** hit **${kc}** kills on **${boss}**!`,
      };
    }
    case "clue_scroll": {
      const tier = typeof detail.tier === "string" ? detail.tier.toLowerCase() : "";
      if (!CLUE_TIERS.includes(tier) || !clientEventId) return null;
      return {
        ruleKey: `clue_${tier}`,
        dedupeKey: `clue:${tier}:${clientEventId}`,
        message: `🗺️ **${rsn}** completed a **${tier}** clue scroll!`,
      };
    }
    case "pet_drop": {
      const petName = typeof detail.petName === "string" ? detail.petName.trim() : "";
      if (!petName || !clientEventId) return null;
      return {
        ruleKey: "pet_drop",
        dedupeKey: `pet:${petName}:${clientEventId}`,
        message: `🐾 **${rsn}** received a pet: **${petName}**!!`,
      };
    }
    default:
      return null;
  }
}

export async function getPointsBalance(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase.from("clan_points_ledger").select("points").eq("user_id", userId);
  return (data ?? []).reduce((sum, row) => sum + row.points, 0);
}

export async function getPointsLeaderboard(supabase: SupabaseClient, limit: number): Promise<{ userId: string; rsn: string; points: number }[]> {
  const { data: ledgerRows } = await supabase.from("clan_points_ledger").select("user_id, points");
  const totals = new Map<string, number>();
  for (const row of ledgerRows ?? []) {
    totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + row.points);
  }

  const ranked = [...totals.entries()]
    .filter(([, points]) => points > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, rsn")
    .in("id", ranked.map(([userId]) => userId));

  const rsnById = new Map((profiles ?? []).map((p) => [p.id, p.rsn]));

  return ranked
    .map(([userId, points]) => ({ userId, rsn: rsnById.get(userId) ?? "Unknown", points }))
    .filter((row) => row.rsn !== "Unknown");
}

/**
 * Records one plugin-reported event: resolves the points value from
 * clan_points_rules server-side (a client-sent points value is never
 * trusted), inserts a ledger row, and posts a Discord notification --
 * skipped entirely if the rule is disabled, and the Discord post is skipped
 * on a duplicate (retried/replayed) report so a retry can never double-post.
 */
export async function recordPluginEvent(
  supabase: SupabaseClient,
  userId: string,
  rsn: string,
  eventType: PluginEventType,
  detail: Record<string, unknown>,
  clientEventId?: string
): Promise<{ ok: true; duplicate: boolean; pointsAwarded: number; newBalance: number } | { ok: false; error: string }> {
  const resolved = resolveEvent(rsn, eventType, detail, clientEventId);
  if (!resolved) return { ok: false, error: "Invalid event payload." };

  const { data: rule } = await supabase
    .from("clan_points_rules")
    .select("points, enabled")
    .eq("rule_key", resolved.ruleKey)
    .maybeSingle();

  if (!rule || !rule.enabled) {
    const balance = await getPointsBalance(supabase, userId);
    return { ok: true, duplicate: false, pointsAwarded: 0, newBalance: balance };
  }

  const { error: insertError } = await supabase
    .from("clan_points_ledger")
    .insert({
      user_id: userId,
      points: rule.points,
      reason: resolved.message,
      source_type: eventType,
      rule_key: resolved.ruleKey,
      dedupe_key: resolved.dedupeKey,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const balance = await getPointsBalance(supabase, userId);
      return { ok: true, duplicate: true, pointsAwarded: 0, newBalance: balance };
    }
    return { ok: false, error: "Failed to record event." };
  }

  const channelId = await getAlertChannel(supabase, EVENT_ALERT_KEYS[eventType]);
  if (channelId) {
    try {
      await postToChannel(channelId, resolved.message);
    } catch {
      // Points are already recorded -- a Discord post failure shouldn't
      // fail the whole request or cost the player their points.
    }
  }

  const newBalance = await getPointsBalance(supabase, userId);
  return { ok: true, duplicate: false, pointsAwarded: rule.points, newBalance };
}
