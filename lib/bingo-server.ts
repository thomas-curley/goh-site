import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAlertChannel } from "@/lib/alert-channels";
import { postToDestination } from "@/lib/discord";
import { normalizeRsn } from "@/lib/wom";
import {
  boardLines,
  computeStandings,
  type BingoEvent,
  type BingoProgress,
  type BingoTeam,
  type BingoTile,
} from "@/lib/bingo";

export function bingoServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const EVENT_COLUMNS =
  "id, name, description, rules, banner_url, starts_at, ends_at, grid_size, status, win_rule, line_bonus, blackout_bonus, hide_other_teams, last_synced_at, created_at, updated_at";
export const TILE_COLUMNS =
  "id, position, title, description, points, icon_kind, icon_ref, icon_item_id, kind, required_count, accepted_items, metric, target, auto_mode";

export interface BingoBundle {
  event: BingoEvent;
  teams: BingoTeam[];
  tiles: BingoTile[];
  progress: BingoProgress[];
}

/** Everything a board needs, in four queries. */
export async function loadBingoBundle(supabase: SupabaseClient, eventId: string): Promise<BingoBundle | null> {
  const { data: event } = await supabase.from("bingo_events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  if (!event) return null;
  const [{ data: teams }, { data: members }, { data: tiles }, { data: progress }] = await Promise.all([
    supabase.from("bingo_teams").select("id, name, color, sort_order").eq("event_id", eventId).order("sort_order").order("created_at"),
    supabase.from("bingo_team_members").select("team_id, rsn, is_captain").eq("event_id", eventId).order("created_at"),
    supabase.from("bingo_tiles").select(TILE_COLUMNS).eq("event_id", eventId).order("position"),
    supabase.from("bingo_progress").select("tile_id, team_id, progress, contributors, completed_at").eq("event_id", eventId),
  ]);
  return {
    event: event as BingoEvent,
    teams: (teams ?? []).map((t) => ({
      ...t,
      members: (members ?? []).filter((m) => m.team_id === t.id).map((m) => ({ rsn: m.rsn, is_captain: m.is_captain })),
    })) as BingoTeam[],
    tiles: (tiles ?? []).map((t) => ({ ...t, target: t.target == null ? null : Number(t.target) })) as BingoTile[],
    progress: (progress ?? []).map((p) => ({ ...p, progress: Number(p.progress) })) as BingoProgress[],
  };
}

/** A signed-in user's main and alt RSNs. */
export async function userRsns(supabase: SupabaseClient, userId: string): Promise<{ main: string | null; verified: boolean; all: string[] }> {
  const [{ data: profile }, { data: alts }] = await Promise.all([
    supabase.from("user_profiles").select("rsn, rsn_verified").eq("id", userId).maybeSingle(),
    supabase.from("user_alt_rsns").select("rsn").eq("user_id", userId),
  ]);
  const all = [profile?.rsn, ...(alts ?? []).map((a) => a.rsn)].filter((r): r is string => !!r);
  return { main: profile?.rsn ?? null, verified: !!profile?.rsn_verified, all };
}

/** Which team (and as which RSN) a set of RSNs plays on in this event. */
export function findTeamFor(teams: BingoTeam[], rsns: string[]): { teamId: string; rsn: string; isCaptain: boolean } | null {
  const wanted = new Set(rsns.map(normalizeRsn));
  for (const team of teams) {
    for (const m of team.members) {
      if (wanted.has(normalizeRsn(m.rsn))) return { teamId: team.id, rsn: m.rsn, isCaptain: m.is_captain };
    }
  }
  return null;
}

export async function logActivity(
  supabase: SupabaseClient,
  row: { event_id: string; team_id?: string | null; tile_id?: string | null; kind: string; rsn?: string | null; points?: number; message: string }
) {
  await supabase.from("bingo_activity").insert({ points: 0, ...row });
}

async function announce(supabase: SupabaseClient, title: string, content: string, images?: string[]) {
  try {
    const channelId = await getAlertChannel(supabase, "bingo_completions");
    if (channelId) await postToDestination(channelId, title, content, images && images.length > 0 ? images : undefined);
  } catch (err) {
    console.error("Bingo Discord post failed:", err);
  }
}

/**
 * Saves a team's progress on one tile and handles what follows when the
 * tile becomes complete: the activity feed, any rows/columns/diagonals or
 * blackout it finishes, and the Discord announcement. Used by reviews
 * (proof tiles) and the Wise Old Man sync (auto tiles).
 */
export async function setTileProgress(
  supabase: SupabaseClient,
  bundle: BingoBundle,
  tile: BingoTile,
  teamId: string,
  progress: number,
  contributors: Record<string, number>,
  opts: { byRsn?: string | null; images?: string[] } = {}
): Promise<{ completedNow: boolean }> {
  const { event, tiles } = bundle;
  const goal = tile.kind === "auto" ? tile.target ?? Infinity : tile.required_count;
  const existing = bundle.progress.find((p) => p.tile_id === tile.id && p.team_id === teamId);
  const wasDone = !!existing?.completed_at;
  const isDone = progress >= goal;
  const now = new Date().toISOString();
  const completedAt = isDone ? existing?.completed_at ?? now : null;

  await supabase.from("bingo_progress").upsert(
    { tile_id: tile.id, team_id: teamId, event_id: event.id, progress, contributors, completed_at: completedAt, updated_at: now },
    { onConflict: "tile_id,team_id" }
  );

  // Keep the in-memory bundle current so later calls in the same sync see it.
  const row = { tile_id: tile.id, team_id: teamId, progress, contributors, completed_at: completedAt };
  if (existing) Object.assign(existing, row);
  else bundle.progress.push(row);

  if (!isDone || wasDone || event.status !== "active") return { completedNow: false };

  const team = bundle.teams.find((t) => t.id === teamId);
  const teamName = team?.name ?? "A team";
  const who = opts.byRsn ?? topContributor(contributors);
  await logActivity(supabase, {
    event_id: event.id,
    team_id: teamId,
    tile_id: tile.id,
    kind: "tile",
    rsn: who,
    points: tile.points,
    message: `${who ? `${who} completed` : "Completed"} ${tile.title} for ${teamName}`,
  });

  // Lines and blackout this tile just finished.
  const doneIds = new Set(bundle.progress.filter((p) => p.team_id === teamId && p.completed_at).map((p) => p.tile_id));
  const tileAt = new Map(tiles.map((t) => [t.position, t]));
  const finished = (pos: number) => {
    const t = tileAt.get(pos);
    return !!t && doneIds.has(t.id);
  };
  const newLines = boardLines(event.grid_size).filter((l) => l.positions.includes(tile.position) && l.positions.every(finished));
  for (const line of newLines) {
    await logActivity(supabase, {
      event_id: event.id,
      team_id: teamId,
      tile_id: tile.id,
      kind: "line",
      points: event.line_bonus,
      message: `${teamName} finished ${line.key.startsWith("d") ? "a diagonal" : line.label.toLowerCase()}`,
    });
  }
  const squares = event.grid_size * event.grid_size;
  const blackout = Array.from({ length: squares }, (_, p) => p).every(finished);
  if (blackout) {
    await logActivity(supabase, { event_id: event.id, team_id: teamId, kind: "blackout", points: event.blackout_bonus, message: `${teamName} finished the whole board!` });
  }

  const standings = computeStandings(event, tiles, bundle.teams.map((t) => t.id), bundle.progress);
  const rank = standings.findIndex((s) => s.teamId === teamId) + 1;
  const score = standings.find((s) => s.teamId === teamId)?.total ?? 0;
  const extras = [
    ...newLines.map(() => `+${event.line_bonus} for a line`),
    ...(blackout ? [`+${event.blackout_bonus} for a blackout`] : []),
  ];
  await announce(
    supabase,
    `${teamName}: ${tile.title}`,
    [
      blackout ? `🏆 **${teamName}** finished the whole board in **${event.name}**!` : `✅ **${teamName}** completed **${tile.title}** in **${event.name}**${who ? ` (thanks to ${who})` : ""}.`,
      `+${tile.points} ${tile.points === 1 ? "point" : "points"}${extras.length ? `, ${extras.join(", ")}` : ""} · now ${score} points, ${ordinal(rank)} place`,
    ].join("\n"),
    opts.images
  );
  return { completedNow: true };
}

function topContributor(contributors: Record<string, number>): string | null {
  const entries = Object.entries(contributors).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Re-adds a proof tile's approved submissions for one team and saves the result. */
export async function recomputeProofTile(
  supabase: SupabaseClient,
  bundle: BingoBundle,
  tile: BingoTile,
  teamId: string,
  opts: { byRsn?: string | null; images?: string[] } = {}
) {
  const { data: approved } = await supabase
    .from("bingo_submissions")
    .select("submitter_rsn, quantity")
    .eq("tile_id", tile.id)
    .eq("team_id", teamId)
    .eq("status", "approved");
  const contributors: Record<string, number> = {};
  let total = 0;
  for (const s of approved ?? []) {
    total += s.quantity;
    contributors[s.submitter_rsn] = (contributors[s.submitter_rsn] ?? 0) + s.quantity;
  }
  return setTileProgress(supabase, bundle, tile, teamId, total, contributors, opts);
}

export interface BingoViewer {
  userId: string | null;
  rsns: string[];
  mainRsn: string | null;
  verified: boolean;
  isStaff: boolean;
}

/** The signed-in member (if any), their RSNs and whether they can manage bingo. */
export async function getBingoViewer(supabase: SupabaseClient): Promise<BingoViewer> {
  const none: BingoViewer = { userId: null, rsns: [], mainRsn: null, verified: false, isStaff: false };
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { checkPermission } = await import("@/lib/check-permission");
    const auth = await createSupabaseServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return none;
    const [rsns, perm] = await Promise.all([userRsns(supabase, user.id), checkPermission("manage_bingo")]);
    return { userId: user.id, rsns: rsns.all, mainRsn: rsns.main, verified: rsns.verified, isStaff: perm.allowed };
  } catch {
    return none;
  }
}

export const MAX_SUBMISSION_IMAGES = 4;

/** Public URL prefix for files in this project's storage, the only images a submission may use. */
export function storagePublicPrefix(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/`;
}

/**
 * Records proof for a tile from a team member (website or Discord). The
 * caller has already worked out who the member is and their team; this
 * checks the board and tile and saves a pending submission for review.
 */
export async function createSubmission(
  supabase: SupabaseClient,
  bundle: BingoBundle,
  input: { tileId: string; teamId: string; rsn: string; userId: string | null; source: "web" | "discord"; imageUrls: string[]; quantity?: number; note?: string | null }
): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const { event } = bundle;
  const now = Date.now();
  if (event.status !== "active") return { ok: false, status: 400, error: "This bingo isn't live." };
  if (event.starts_at && Date.parse(event.starts_at) > now) return { ok: false, status: 400, error: "This bingo hasn't started yet." };
  if (event.ends_at && Date.parse(event.ends_at) < now) return { ok: false, status: 400, error: "This bingo has ended." };

  const tile = bundle.tiles.find((t) => t.id === input.tileId);
  if (!tile) return { ok: false, status: 404, error: "Tile not found." };
  if (tile.kind !== "proof") return { ok: false, status: 400, error: "This tile updates by itself from Wise Old Man, so it doesn't need screenshots." };

  const progress = bundle.progress.find((p) => p.tile_id === tile.id && p.team_id === input.teamId);
  if (progress?.completed_at) return { ok: false, status: 400, error: "Your team has already finished this tile." };

  const imageUrls = input.imageUrls.filter((u) => typeof u === "string" && u.startsWith(storagePublicPrefix())).slice(0, MAX_SUBMISSION_IMAGES);
  if (imageUrls.length === 0) return { ok: false, status: 400, error: "Add at least one screenshot." };

  // Single-drop tiles take one submission at a time; count tiles can stack.
  const { count: pending } = await supabase
    .from("bingo_submissions")
    .select("*", { count: "exact", head: true })
    .eq("tile_id", tile.id)
    .eq("team_id", input.teamId)
    .eq("status", "pending");
  const remaining = tile.required_count - (progress?.progress ?? 0);
  if ((pending ?? 0) >= Math.max(1, remaining)) {
    return { ok: false, status: 400, error: "Your team already has enough waiting for review on this tile. Staff will get to it soon." };
  }

  const quantity = Math.max(1, Math.min(Math.floor(Number(input.quantity) || 1), Math.max(1, remaining)));
  const { data, error } = await supabase
    .from("bingo_submissions")
    .insert({
      event_id: event.id,
      tile_id: tile.id,
      team_id: input.teamId,
      submitted_by: input.userId,
      submitter_rsn: input.rsn,
      source: input.source,
      image_urls: imageUrls,
      quantity,
      note: input.note?.trim().slice(0, 300) || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, status: 500, error: "Couldn't save your submission." };

  const team = bundle.teams.find((t) => t.id === input.teamId);
  await logActivity(supabase, {
    event_id: event.id,
    team_id: input.teamId,
    tile_id: tile.id,
    kind: "submitted",
    rsn: input.rsn,
    message: `${input.rsn} sent proof for ${tile.title}${team ? ` (${team.name})` : ""}`,
  });
  return { ok: true, id: data.id };
}

/** What still stops a board going live (empty when it's ready). */
export function launchProblems(bundle: BingoBundle): string[] {
  const { event, tiles, teams } = bundle;
  const problems: string[] = [];
  const squares = event.grid_size * event.grid_size;
  if (tiles.length < squares) problems.push(`${squares - tiles.length} of ${squares} squares are still empty.`);
  if (teams.length < 2) problems.push("Add at least two teams.");
  const empty = teams.filter((t) => t.members.length === 0);
  if (empty.length) problems.push(`${empty.map((t) => t.name).join(", ")} ${empty.length === 1 ? "has" : "have"} no players.`);
  if (event.starts_at && event.ends_at && Date.parse(event.ends_at) <= Date.parse(event.starts_at)) problems.push("The end date is before the start date.");
  if (!event.ends_at) problems.push("Set an end date, so the board knows when to stop counting.");
  return problems;
}

/** Posts the final standings to the bingo channel when a board finishes. */
export async function announceResults(supabase: SupabaseClient, bundle: BingoBundle) {
  const { event, teams, tiles } = bundle;
  const standings = computeStandings(event, tiles, teams.map((t) => t.id), bundle.progress);
  const medals = ["🥇", "🥈", "🥉"];
  const lines = standings.map((s, i) => {
    const team = teams.find((t) => t.id === s.teamId);
    return `${medals[i] ?? `${i + 1}.`} **${team?.name ?? "Team"}** with ${s.total} points (${s.tilesDone} tiles, ${s.lines.length} ${s.lines.length === 1 ? "line" : "lines"}${s.blackout ? ", blackout" : ""})`;
  });
  const winner = teams.find((t) => t.id === standings[0]?.teamId);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await announce(
    supabase,
    `${event.name}: results`,
    [`🏁 **${event.name}** is over${winner ? `, and **${winner.name}** wins!` : "!"}`, "", ...lines, "", site ? `Full board: ${site}/bingo/${event.id}` : ""].join("\n").trim()
  );
}
