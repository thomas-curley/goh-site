import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { bingoServiceClient } from "@/lib/bingo-server";
import { normalizeRsn } from "@/lib/wom";
import { TEAM_COLORS } from "@/lib/bingo";

interface IncomingTeam {
  id?: string;
  name: string;
  color: string | null;
  members: { rsn: string; is_captain: boolean }[];
}

// PUT - save every team and its players in one go (the teams step). Teams
// keep their ids, so progress on a live board stays attached; a team left
// out of the list is deleted along with its progress.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body.teams) ? body.teams.slice(0, 20) : [];
  const seen = new Set<string>();
  const teams: IncomingTeam[] = [];
  for (const [i, t] of raw.entries()) {
    if (typeof t !== "object" || t === null) continue;
    const r = t as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 40) : "";
    if (!name) return NextResponse.json({ error: `Team ${i + 1} needs a name.` }, { status: 400 });
    const members: IncomingTeam["members"] = [];
    for (const m of Array.isArray(r.members) ? r.members : []) {
      const rsn = typeof m?.rsn === "string" ? m.rsn.trim().slice(0, 12) : "";
      if (!rsn) continue;
      const key = normalizeRsn(rsn);
      if (seen.has(key)) return NextResponse.json({ error: `${rsn} is on more than one team.` }, { status: 400 });
      seen.add(key);
      members.push({ rsn, is_captain: !!m.is_captain });
    }
    teams.push({
      id: typeof r.id === "string" ? r.id : undefined,
      name,
      color: typeof r.color === "string" && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : TEAM_COLORS[i % TEAM_COLORS.length],
      members,
    });
  }
  if (new Set(teams.map((t) => t.name.toLowerCase())).size !== teams.length) {
    return NextResponse.json({ error: "Two teams have the same name." }, { status: 400 });
  }

  const { data: existing } = await supabase.from("bingo_teams").select("id").eq("event_id", id);
  const keepIds = new Set(teams.map((t) => t.id).filter(Boolean));
  const removed = (existing ?? []).filter((t) => !keepIds.has(t.id)).map((t) => t.id);
  if (removed.length) await supabase.from("bingo_teams").delete().in("id", removed);

  await supabase.from("bingo_team_members").delete().eq("event_id", id);
  const saved: { id: string }[] = [];
  for (const [i, team] of teams.entries()) {
    const row = { event_id: id, name: team.name, color: team.color, sort_order: i };
    const known = team.id && (existing ?? []).some((t) => t.id === team.id);
    const { data, error } = known
      ? await supabase.from("bingo_teams").update(row).eq("id", team.id as string).select("id").single()
      : await supabase.from("bingo_teams").insert(row).select("id").single();
    if (error || !data) return NextResponse.json({ error: `Couldn't save ${team.name}.` }, { status: 500 });
    saved.push(data);
    if (team.members.length) {
      const { error: memberError } = await supabase
        .from("bingo_team_members")
        .insert(team.members.map((m) => ({ team_id: data.id, event_id: id, rsn: m.rsn, is_captain: m.is_captain })));
      if (memberError) return NextResponse.json({ error: `Couldn't save ${team.name}'s players.` }, { status: 500 });
    }
  }
  return NextResponse.json({ saved: true, teamIds: saved.map((t) => t.id) });
}
