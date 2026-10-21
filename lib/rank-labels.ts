import type { SupabaseClient } from "@supabase/supabase-js";

/** Custom names and descriptions for ranks, by rank key (gold_key, yew, ...). Missing or blank means use the standard one. */
export type RankLabels = Record<string, { label: string | null; description: string | null }>;

export async function getRankLabels(supabase: SupabaseClient): Promise<RankLabels> {
  const { data } = await supabase.from("rank_labels").select("rank_key, label, description");
  return Object.fromEntries((data ?? []).map((r) => [r.rank_key, { label: r.label?.trim() || null, description: r.description?.trim() || null }]));
}
