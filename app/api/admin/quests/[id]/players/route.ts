import { NextRequest, NextResponse, after } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { logQuestActivity, questServiceClient, syncParticipant, loadQuestBundle } from "@/lib/quest-server";
import { normalizeRsn } from "@/lib/wom";
import { TEAM_COLORS } from "@/lib/bingo";

// PUT - save the players (and, for team events, the teams) in one go.
//   { teams: [{ id?, name, color }], players: [{ rsn, team: <index into teams> | null, is_captain }] }
// Players are matched by RSN, so anyone already in keeps their starting
// snapshot and finished quests. Anyone left out is removed along with them.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_quests");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: event } = await supabase.from("quest_events").select("id, format").eq("id", id).maybeSingle();
  if (!event) return NextResponse.json({ error: "Quest event not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const rawTeams: unknown[] = event.format === "teams" && Array.isArray(body.teams) ? body.teams.slice(0, 20) : [];
  const teams: { id?: string; name: string; color: string }[] = [];
  for (const [i, t] of rawTeams.entries()) {
    const r = (typeof t === "object" && t ? t : {}) as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 40) : "";
    if (!name) return NextResponse.json({ error: `Team ${i + 1} needs a name.` }, { status: 400 });
    teams.push({
      id: typeof r.id === "string" ? r.id : undefined,
      name,
      color: typeof r.color === "string" && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : TEAM_COLORS[i % TEAM_COLORS.length],
    });
  }
  if (new Set(teams.map((t) => t.name.toLowerCase())).size !== teams.length) return NextResponse.json({ error: "Two teams have the same name." }, { status: 400 });

  const seen = new Set<string>();
  const players: { rsn: string; team: number | null; is_captain: boolean }[] = [];
  for (const p of Array.isArray(body.players) ? body.players.slice(0, 500) : []) {
    const rsn = typeof p?.rsn === "string" ? p.rsn.trim().slice(0, 12) : "";
    if (!rsn) continue;
    const key = normalizeRsn(rsn);
    if (seen.has(key)) return NextResponse.json({ error: `${rsn} is listed twice.` }, { status: 400 });
    seen.add(key);
    const team = Number.isInteger(p.team) && p.team >= 0 && p.team < teams.length ? (p.team as number) : null;
    players.push({ rsn, team, is_captain: team !== null && !!p.is_captain });
  }

  // Teams: keep ids, delete the ones left out, then upsert in order.
  const { data: existingTeams } = await supabase.from("quest_event_teams").select("id").eq("event_id", id);
  const keepTeamIds = new Set(teams.map((t) => t.id).filter(Boolean));
  const removedTeams = (existingTeams ?? []).filter((t) => !keepTeamIds.has(t.id)).map((t) => t.id);
  if (removedTeams.length) await supabase.from("quest_event_teams").delete().in("id", removedTeams);
  const teamIds: string[] = [];
  for (const [i, team] of teams.entries()) {
    const row = { event_id: id, name: team.name, color: team.color, sort_order: i };
    const known = team.id && (existingTeams ?? []).some((t) => t.id === team.id);
    const { data, error } = known
      ? await supabase.from("quest_event_teams").update(row).eq("id", team.id as string).select("id").single()
      : await supabase.from("quest_event_teams").insert(row).select("id").single();
    if (error || !data) return NextResponse.json({ error: `Couldn't save ${team.name}.` }, { status: 500 });
    teamIds.push(data.id);
  }

  // Players: update the ones already in, add the new ones, remove the rest.
  const { data: existing } = await supabase.from("quest_event_participants").select("id, rsn").eq("event_id", id);
  const added: string[] = [];
  const byKey = new Map((existing ?? []).map((p) => [normalizeRsn(p.rsn), p]));
  const removed = (existing ?? []).filter((p) => !seen.has(normalizeRsn(p.rsn))).map((p) => p.id);
  if (removed.length) await supabase.from("quest_event_participants").delete().in("id", removed);
  for (const p of players) {
    const row = { team_id: p.team === null ? null : teamIds[p.team], is_captain: p.is_captain };
    const found = byKey.get(normalizeRsn(p.rsn));
    if (found) {
      await supabase.from("quest_event_participants").update(row).eq("id", found.id);
    } else {
      const { data: row2, error } = await supabase.from("quest_event_participants").insert({ ...row, event_id: id, rsn: p.rsn }).select("id").single();
      if (error || !row2) return NextResponse.json({ error: `Couldn't add ${p.rsn}.` }, { status: 500 });
      await logQuestActivity(supabase, { event_id: id, participant_id: row2.id, kind: "joined" });
      added.push(row2.id);
    }
  }
  // Take the new players' starting snapshot (or count nothing yet, in a draft).
  if (added.length) {
    after(async () => {
      const bundle = await loadQuestBundle(supabase, id);
      if (!bundle || bundle.event.status === "draft" || bundle.event.status === "completed") return;
      for (const p of bundle.participants.filter((x) => added.includes(x.id))) await syncParticipant(supabase, bundle, p).catch(() => undefined);
    });
  }
  return NextResponse.json({ saved: true, teamIds });
}
