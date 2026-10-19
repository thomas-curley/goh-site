import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { getFullGroupHiscores, normalizeRsn } from "@/lib/wom";

/** Each clan member's efficient hours (EHP + EHB) from Wise Old Man, by normalised RSN. */
async function efficiencyHours(): Promise<Map<string, number>> {
  const hours = new Map<string, number>();
  for (const metric of ["ehp", "ehb"]) {
    const rows = (await getFullGroupHiscores(metric)) ?? [];
    for (const r of rows as { player: { username: string; displayName: string }; data: { value?: number } }[]) {
      const key = normalizeRsn(r.player.displayName);
      hours.set(key, (hours.get(key) ?? 0) + (r.data.value ?? 0));
    }
  }
  return hours;
}

// POST - suggest balanced teams: players sorted by efficient hours, each
// going to the team with the fewest hours that still has room. Nothing is
// saved; the builder shows the result to adjust.
export async function POST(request: NextRequest) {
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const rsns: string[] = Array.isArray(body.rsns) ? body.rsns.filter((r: unknown): r is string => typeof r === "string" && !!r.trim()).slice(0, 500) : [];
  const teamCount = Math.max(2, Math.min(20, Math.floor(Number(body.teamCount) || 2)));
  if (rsns.length === 0) return NextResponse.json({ error: "There's nobody to put on teams yet." }, { status: 400 });

  const hours = await efficiencyHours();
  const players = rsns.map((rsn) => ({ rsn, hours: Math.round(hours.get(normalizeRsn(rsn)) ?? 0) }));
  const missing = players.filter((p) => !hours.has(normalizeRsn(p.rsn))).map((p) => p.rsn);
  players.sort((a, b) => b.hours - a.hours);

  const cap = Math.ceil(players.length / teamCount);
  const teams = Array.from({ length: teamCount }, () => ({ rsns: [] as string[], hours: 0 }));
  for (const p of players) {
    const open = teams.filter((t) => t.rsns.length < cap);
    const target = open.reduce((best, t) => (t.hours < best.hours || (t.hours === best.hours && t.rsns.length < best.rsns.length) ? t : best), open[0]);
    target.rsns.push(p.rsn);
    target.hours += p.hours;
  }
  return NextResponse.json({ teams, hours: Object.fromEntries(players.map((p) => [p.rsn, p.hours])), missing });
}
