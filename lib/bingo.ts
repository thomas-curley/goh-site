import { MetricProps } from "@wise-old-man/utils";
import { itemIconUrl } from "@/lib/osrs-character";
import { wikiItemIcon } from "@/lib/profiles-format";

export const GRID_SIZES = [3, 4, 5, 6, 7] as const;

export type BingoEventStatus = "draft" | "signups" | "active" | "completed";
export type BingoWinRule = "points" | "blackout";
export type BingoTileKind = "proof" | "auto";
export type BingoAutoMode = "team_total" | "single_player";
export type BingoIconKind = "none" | "item" | "metric";
export type BingoSubmissionStatus = "pending" | "approved" | "rejected";

/** Points per difficulty, the presets offered in the builder. */
export const DIFFICULTIES = [
  { label: "Easy", points: 1 },
  { label: "Medium", points: 2 },
  { label: "Hard", points: 3 },
  { label: "Elite", points: 5 },
] as const;

export interface BingoEvent {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  banner_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  grid_size: number;
  status: BingoEventStatus;
  win_rule: BingoWinRule;
  line_bonus: number;
  blackout_bonus: number;
  hide_other_teams: boolean;
  /** What to do with a matching drop from the clan feed (DropTracker etc.). */
  feed_mode: "off" | "review" | "approve";
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BingoTeamMember {
  rsn: string;
  is_captain: boolean;
}

export interface BingoTeam {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  members: BingoTeamMember[];
}

export interface BingoTile {
  id: string;
  position: number;
  title: string;
  description: string | null;
  points: number;
  icon_kind: BingoIconKind;
  icon_ref: string | null;
  icon_item_id: number | null;
  kind: BingoTileKind;
  required_count: number;
  accepted_items: string[];
  metric: string | null;
  target: number | null;
  auto_mode: BingoAutoMode;
}

export interface BingoProgress {
  tile_id: string;
  team_id: string;
  progress: number;
  contributors: Record<string, number>;
  completed_at: string | null;
}

export interface BingoSubmission {
  id: string;
  tile_id: string;
  team_id: string;
  submitter_rsn: string;
  source: "web" | "discord" | "feed";
  image_urls: string[];
  quantity: number;
  note: string | null;
  status: BingoSubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface BingoActivity {
  id: string;
  team_id: string | null;
  tile_id: string | null;
  kind: "tile" | "line" | "blackout" | "submitted" | "rejected";
  rsn: string | null;
  points: number;
  message: string;
  created_at: string;
}

/** Team colours offered in the builder, in the order new teams take them. */
export const TEAM_COLORS = ["#3E7D2A", "#2E64A8", "#B5462E", "#C08A12", "#7B4BA8", "#1F8A84", "#C2577E", "#5B6770"];

// ── Scoring ─────────────────────────────────────────────────────────

export interface BingoLine {
  key: string; // "r0", "c2", "d0" (top-left to bottom-right), "d1"
  label: string;
  positions: number[];
}

/** Every row, column and both diagonals of an n×n board. */
export function boardLines(gridSize: number): BingoLine[] {
  const n = gridSize;
  const lines: BingoLine[] = [];
  for (let r = 0; r < n; r++) lines.push({ key: `r${r}`, label: `Row ${r + 1}`, positions: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) lines.push({ key: `c${c}`, label: `Column ${c + 1}`, positions: Array.from({ length: n }, (_, r) => r * n + c) });
  lines.push({ key: "d0", label: "Diagonal", positions: Array.from({ length: n }, (_, i) => i * n + i) });
  lines.push({ key: "d1", label: "Diagonal", positions: Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)) });
  return lines;
}

export interface TeamScore {
  teamId: string;
  tilePoints: number;
  tilesDone: number;
  lines: string[]; // keys of finished lines
  blackout: boolean;
  total: number;
  /** When the team's score last went up; earlier wins a tie. */
  lastScoredAt: string | null;
  blackoutAt: string | null;
}

/**
 * Scores one team. A line counts only when every square on it has a tile
 * and the team has finished all of them; a blackout needs every square.
 */
export function scoreTeam(
  event: Pick<BingoEvent, "grid_size" | "line_bonus" | "blackout_bonus">,
  tiles: Pick<BingoTile, "id" | "position" | "points">[],
  completedAt: Map<string, string>, // tile id -> completed_at, for this team
  teamId: string
): TeamScore {
  const byPosition = new Map(tiles.map((t) => [t.position, t]));
  const doneAt = (pos: number) => {
    const tile = byPosition.get(pos);
    return tile ? completedAt.get(tile.id) ?? null : null;
  };

  let tilePoints = 0;
  let tilesDone = 0;
  let last: string | null = null;
  const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
  for (const t of tiles) {
    const at = completedAt.get(t.id);
    if (!at) continue;
    tilePoints += t.points;
    tilesDone++;
    last = later(last, at);
  }

  const lines: string[] = [];
  for (const line of boardLines(event.grid_size)) {
    const times = line.positions.map(doneAt);
    if (times.every(Boolean)) lines.push(line.key);
  }

  const squares = event.grid_size * event.grid_size;
  const allTimes = Array.from({ length: squares }, (_, p) => doneAt(p));
  const blackout = allTimes.every(Boolean);
  const blackoutAt = blackout ? allTimes.reduce<string | null>((a, b) => later(a, b), null) : null;

  return {
    teamId,
    tilePoints,
    tilesDone,
    lines,
    blackout,
    total: tilePoints + lines.length * event.line_bonus + (blackout ? event.blackout_bonus : 0),
    lastScoredAt: last,
    blackoutAt,
  };
}

/** Standings, best first. "blackout" events rank finished boards by when they finished, then everyone else by points. */
export function rankTeams(scores: TeamScore[], winRule: BingoWinRule): TeamScore[] {
  return [...scores].sort((a, b) => {
    if (winRule === "blackout" && a.blackout !== b.blackout) return a.blackout ? -1 : 1;
    if (winRule === "blackout" && a.blackoutAt && b.blackoutAt && a.blackoutAt !== b.blackoutAt) return a.blackoutAt < b.blackoutAt ? -1 : 1;
    if (a.total !== b.total) return b.total - a.total;
    if (a.tilesDone !== b.tilesDone) return b.tilesDone - a.tilesDone;
    // Same score: whoever got there first.
    if (a.lastScoredAt && b.lastScoredAt && a.lastScoredAt !== b.lastScoredAt) return a.lastScoredAt < b.lastScoredAt ? -1 : 1;
    return 0;
  });
}

/** Most points a team can score on this board. */
export function maxScore(event: Pick<BingoEvent, "grid_size" | "line_bonus" | "blackout_bonus">, tiles: Pick<BingoTile, "points">[]): number {
  const n = event.grid_size;
  return tiles.reduce((s, t) => s + t.points, 0) + (2 * n + 2) * event.line_bonus + event.blackout_bonus;
}

/** A shuffled copy (Fisher-Yates). */
export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Display helpers ─────────────────────────────────────────────────

export function metricLabel(metric: string): string {
  return (MetricProps as Record<string, { name: string }>)[metric]?.name ?? metric.replace(/_/g, " ");
}

export function metricMeasure(metric: string): string {
  const type = (MetricProps as Record<string, { type?: string }>)[metric]?.type;
  if (type === "skill") return "XP";
  if (type === "boss") return "KC";
  if (type === "computed") return "hours";
  return "";
}

export function metricIconUrl(metric: string): string {
  return `https://wiseoldman.net/img/runescape/icons_small/${metric}.png`;
}

/** Image sources to try in order for a tile's icon (empty when it has none). */
export function tileIconSources(tile: Pick<BingoTile, "icon_kind" | "icon_ref" | "icon_item_id">): string[] {
  if (tile.icon_kind === "metric" && tile.icon_ref) return [metricIconUrl(tile.icon_ref)];
  if (tile.icon_kind === "item" && tile.icon_ref) {
    return [...(tile.icon_item_id ? [itemIconUrl(tile.icon_item_id)] : []), wikiItemIcon(tile.icon_ref)];
  }
  return [];
}

export function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${+(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
}

/** "12 / 50 KC", "1 / 2". */
export function progressText(tile: Pick<BingoTile, "kind" | "required_count" | "target" | "metric">, progress: number): string {
  if (tile.kind === "auto") {
    const unit = tile.metric ? metricMeasure(tile.metric) : "";
    return `${formatAmount(Math.floor(progress))} / ${formatAmount(tile.target ?? 0)}${unit ? ` ${unit}` : ""}`;
  }
  return `${progress} / ${tile.required_count}`;
}

export function tileGoal(tile: Pick<BingoTile, "kind" | "required_count" | "target">): number {
  return tile.kind === "auto" ? tile.target ?? 0 : tile.required_count;
}

export const STATUS_LABELS: Record<BingoEventStatus, string> = {
  draft: "Draft",
  signups: "Sign-ups open",
  active: "Live",
  completed: "Finished",
};

/** Ranked scores for every team from the board's progress rows. */
export function computeStandings(
  event: Pick<BingoEvent, "grid_size" | "line_bonus" | "blackout_bonus" | "win_rule">,
  tiles: Pick<BingoTile, "id" | "position" | "points">[],
  teamIds: string[],
  progress: Pick<BingoProgress, "tile_id" | "team_id" | "completed_at">[]
): TeamScore[] {
  const done = new Map<string, Map<string, string>>(teamIds.map((id) => [id, new Map()]));
  for (const p of progress) if (p.completed_at) done.get(p.team_id)?.set(p.tile_id, p.completed_at);
  return rankTeams(
    teamIds.map((id) => scoreTeam(event, tiles, done.get(id) ?? new Map(), id)),
    event.win_rule
  );
}
