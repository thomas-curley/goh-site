import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompetitionTeamProgress } from "@/lib/wom";

/**
 * Syncs every WOM-tracked tile's per-team progress for one bingo event: pulls
 * each tile's linked competition's team totals from WOM, upserts
 * wom_progress_value, and flips a (tile, team) completion to "completed"
 * once its progress crosses wom_target_value. Shared by the daily cron
 * (app/api/cron/bingo-sync) and the admin "Refresh Now" button
 * (app/api/admin/bingo/[id]/refresh) -- same logic, different trigger.
 */
export async function syncEventWomTiles(supabase: SupabaseClient, eventId: string): Promise<{ tilesSynced: number; errors: string[] }> {
  const { data: teams } = await supabase.from("bingo_teams").select("id, name").eq("event_id", eventId);
  const teamIdByName = new Map((teams ?? []).map((t) => [t.name, t.id as string]));

  const { data: tiles } = await supabase
    .from("bingo_tiles")
    .select("id, wom_target_value, wom_competition_id")
    .eq("event_id", eventId)
    .eq("tracking_type", "wom")
    .not("wom_competition_id", "is", null);

  let tilesSynced = 0;
  const errors: string[] = [];

  for (const tile of tiles ?? []) {
    const { data: comp } = await supabase.from("wom_competitions").select("wom_id").eq("id", tile.wom_competition_id).maybeSingle();
    if (!comp) continue;

    const progress = await getCompetitionTeamProgress(comp.wom_id);
    if (progress.length === 0) continue;

    for (const { teamName, gained } of progress) {
      const teamId = teamIdByName.get(teamName);
      if (!teamId) continue;

      const status = tile.wom_target_value != null && gained >= tile.wom_target_value ? "completed" : "incomplete";
      const { error } = await supabase
        .from("bingo_tile_completions")
        .update({ wom_progress_value: gained, status, updated_at: new Date().toISOString() })
        .eq("tile_id", tile.id)
        .eq("team_id", teamId);

      if (error) errors.push(`Failed to update tile ${tile.id} / team ${teamName}: ${error.message}`);
    }
    tilesSynced++;
  }

  return { tilesSynced, errors };
}
