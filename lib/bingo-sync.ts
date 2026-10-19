import type { SupabaseClient } from "@supabase/supabase-js";
import { getGroupGains, normalizeRsn } from "@/lib/wom";
import { loadBingoBundle, setTileProgress } from "@/lib/bingo-server";

/**
 * Updates every auto-tracked tile on one live board from Wise Old Man.
 * One group-gains request per distinct metric covers every player in the
 * clan for the event's dates; each team's progress is its members' total
 * (or its best single player, for "one player must do it" tiles). Shared
 * by the daily cron, the bot's regular refresh, the staff "Refresh now"
 * button and the stale-board refresh when someone opens a board.
 *
 * Skips the work when the board was synced less than `minAgeMinutes` ago.
 */
export async function syncEventAutoTiles(
  supabase: SupabaseClient,
  eventId: string,
  { minAgeMinutes = 0 }: { minAgeMinutes?: number } = {}
): Promise<{ tilesSynced: number; skipped?: boolean; errors: string[] }> {
  const bundle = await loadBingoBundle(supabase, eventId);
  if (!bundle || bundle.event.status !== "active") return { tilesSynced: 0, skipped: true, errors: [] };
  const { event } = bundle;

  if (minAgeMinutes > 0 && event.last_synced_at && Date.now() - Date.parse(event.last_synced_at) < minAgeMinutes * 60_000) {
    return { tilesSynced: 0, skipped: true, errors: [] };
  }
  const autoTiles = bundle.tiles.filter((t) => t.kind === "auto" && t.metric && t.target);
  // Claim the sync first so two page views don't both run it.
  await supabase.from("bingo_events").update({ last_synced_at: new Date().toISOString() }).eq("id", eventId);
  if (autoTiles.length === 0) return { tilesSynced: 0, errors: [] };

  const start = new Date(event.starts_at ?? event.created_at);
  const end = new Date(Math.min(Date.now(), event.ends_at ? Date.parse(event.ends_at) : Date.now()));
  if (end <= start) return { tilesSynced: 0, errors: [] };

  // RSN (normalised) -> team and the name as written on the team list.
  const teamOf = new Map<string, string>();
  const rosterName = new Map<string, string>();
  for (const team of bundle.teams) {
    for (const m of team.members) {
      teamOf.set(normalizeRsn(m.rsn), team.id);
      rosterName.set(normalizeRsn(m.rsn), m.rsn);
    }
  }

  const errors: string[] = [];
  const gainsByMetric = new Map<string, Awaited<ReturnType<typeof getGroupGains>>>();
  for (const metric of new Set(autoTiles.map((t) => t.metric as string))) {
    const gains = await getGroupGains(metric, start, end, 500);
    if (gains.length === 0) errors.push(`No Wise Old Man gains came back for ${metric}.`);
    gainsByMetric.set(metric, gains);
  }

  let tilesSynced = 0;
  for (const tile of autoTiles) {
    const gains = gainsByMetric.get(tile.metric as string) ?? [];
    for (const team of bundle.teams) {
      const contributors: Record<string, number> = {};
      for (const g of gains) {
        if (g.gained <= 0) continue;
        const key = teamOf.has(normalizeRsn(g.displayName)) ? normalizeRsn(g.displayName) : normalizeRsn(g.username);
        if (teamOf.get(key) !== team.id) continue;
        contributors[rosterName.get(key) ?? g.displayName] = g.gained;
      }
      const values = Object.values(contributors);
      const progress = tile.auto_mode === "single_player" ? Math.max(0, ...values) : values.reduce((s, v) => s + v, 0);
      const before = bundle.progress.find((p) => p.tile_id === tile.id && p.team_id === team.id);
      // Gains only grow, so a smaller number means WOM came back short; keep what we had.
      if (before && progress < before.progress) continue;
      if (before && progress === before.progress) continue;
      try {
        await setTileProgress(supabase, bundle, tile, team.id, progress, contributors);
      } catch (err) {
        errors.push(`Couldn't save ${tile.title} for ${team.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    tilesSynced++;
  }
  return { tilesSynced, errors };
}
