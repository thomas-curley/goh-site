import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SKILLS, BOSSES, SkillProps, BossProps } from "@wise-old-man/utils";
import { getFullGroupHiscores, normalizeRsn } from "@/lib/wom";

export type RankedMetricType = "skill" | "boss" | "computed";

export interface RankingMetric {
  key: string;
  type: RankedMetricType;
  name: string;
}

/** Every metric the profiles rank members on: all skills (incl. overall), all bosses, EHP and EHB. */
export const RANKING_METRICS: RankingMetric[] = [
  ...SKILLS.map((s) => ({ key: s as string, type: "skill" as const, name: SkillProps[s].name })),
  ...BOSSES.map((b) => ({ key: b as string, type: "boss" as const, name: BossProps[b].name })),
  { key: "ehp", type: "computed", name: "Efficient Hours Played" },
  { key: "ehb", type: "computed", name: "Efficient Hours Bossed" },
];

export interface MemberRanking {
  metric: string;
  metric_type: RankedMetricType;
  value: number;
  level: number | null;
  clan_rank: number;
  ranked_count: number;
  captured_at: string;
}

/**
 * Pulls WOM group hiscores for every metric (~85 calls, 8 at a time -- run
 * from the daily cron or the admin button, never on a page load) and
 * replaces each metric's rows. Members with no progress in a metric (0 XP,
 * 0 kills) aren't ranked in it. Returns how many metrics were refreshed.
 */
export async function refreshClanRankings(supabase: SupabaseClient): Promise<{ refreshed: number; failed: string[] }> {
  const BATCH_SIZE = 8;
  const failed: string[] = [];
  let refreshed = 0;
  const capturedAt = new Date().toISOString();

  for (let i = 0; i < RANKING_METRICS.length; i += BATCH_SIZE) {
    const batch = RANKING_METRICS.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (metric) => {
        const entries = await getFullGroupHiscores(metric.key);
        if (!entries) {
          failed.push(metric.key);
          return;
        }
        const scored = entries
          .map((e) => {
            const d = e.data as { type: string; level?: number; experience?: number; kills?: number; value?: number };
            const value = d.type === "skill" ? d.experience ?? 0 : d.type === "boss" ? d.kills ?? 0 : d.value ?? 0;
            return { name: e.player.displayName, value, level: d.type === "skill" ? d.level ?? null : null };
          })
          .filter((e) => e.value > 0)
          .sort((a, b) => b.value - a.value);

        const rows = scored.map((e) => ({
          metric: metric.key,
          metric_type: metric.type,
          rsn_key: normalizeRsn(e.name),
          display_name: e.name,
          value: e.value,
          level: e.level,
          // Ties share a rank (the first index with that value).
          clan_rank: scored.findIndex((x) => x.value === e.value) + 1,
          ranked_count: scored.length,
          captured_at: capturedAt,
        }));

        const { error: deleteError } = await supabase.from("clan_metric_rankings").delete().eq("metric", metric.key);
        if (deleteError) {
          failed.push(metric.key);
          return;
        }
        // Two names can normalize the same; keep the higher one.
        const unique = [...new Map(rows.reverse().map((r) => [r.rsn_key, r])).values()];
        if (unique.length > 0) {
          const { error } = await supabase.from("clan_metric_rankings").insert(unique);
          if (error) {
            failed.push(metric.key);
            return;
          }
        }
        refreshed++;
      })
    );
  }
  return { refreshed, failed };
}

/** One member's rankings, keyed by metric. */
export async function getMemberRankings(supabase: SupabaseClient, rsn: string): Promise<Map<string, MemberRanking>> {
  const { data } = await supabase
    .from("clan_metric_rankings")
    .select("metric, metric_type, value, level, clan_rank, ranked_count, captured_at")
    .eq("rsn_key", normalizeRsn(rsn));
  return new Map(((data ?? []) as MemberRanking[]).map((r) => [r.metric, r]));
}
