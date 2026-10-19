"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { shuffled, TEAM_COLORS } from "@/lib/bingo";
import { normalizeRsn } from "@/lib/wom";
import { inputClass } from "./BasicsStep";
import type { AdminBingo } from "./BingoBuilder";

interface Member {
  rsn: string;
  is_captain: boolean;
}
interface TeamDraft {
  id?: string;
  name: string;
  color: string;
  members: Member[];
}

const POOL = "pool";
const TEAM_NAMES = ["Gnome Guard", "Glider Pilots", "Ball Hoppers", "Crunchy Bowls", "Tree Huggers", "Agility Arena", "Spirit Trees", "Battlemages"];

function splitList(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s && !seen.has(normalizeRsn(s)) && (seen.add(normalizeRsn(s)), true));
}

export function TeamsStep({ data, onSaved, onNext }: { data: AdminBingo; onSaved: () => Promise<void>; onNext: () => void }) {
  const { event } = data;
  const initialTeams = (): TeamDraft[] =>
    data.teams.length
      ? data.teams.map((t, i) => ({ id: t.id, name: t.name, color: t.color ?? TEAM_COLORS[i % TEAM_COLORS.length], members: t.members.map((m) => ({ ...m })) }))
      : [0, 1].map((i) => ({ name: TEAM_NAMES[i], color: TEAM_COLORS[i], members: [] }));
  const [teams, setTeams] = useState<TeamDraft[]>(initialTeams);
  const [extraPool, setExtraPool] = useState<string[]>([]);
  const [dirty, setDirty] = useState(data.teams.length === 0);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [hours, setHours] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [roster, setRoster] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  useEffect(() => {
    fetch("/api/clan-members")
      .then((r) => r.json())
      .then((d) => setRoster((d.members ?? []).map((m: { displayName: string }) => m.displayName)))
      .catch(() => setRoster([]));
  }, []);

  const placed = useMemo(() => new Set(teams.flatMap((t) => t.members.map((m) => normalizeRsn(m.rsn)))), [teams]);
  // Waiting to be placed: sign-ups not on a team, plus anyone added by hand.
  const pool = useMemo(() => {
    const names = [...data.signups.map((s) => s.rsn), ...extraPool];
    const seen = new Set<string>();
    return names.filter((r) => {
      const k = normalizeRsn(r);
      if (placed.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [data.signups, extraPool, placed]);
  const notes = new Map(data.signups.map((s) => [normalizeRsn(s.rsn), s.note]));

  const update = (fn: (t: TeamDraft[]) => TeamDraft[]) => {
    setTeams(fn);
    setDirty(true);
    setNotice(null);
  };

  const move = (rsn: string, to: string) => {
    const key = normalizeRsn(rsn);
    update((prev) => {
      const without = prev.map((t) => ({ ...t, members: t.members.filter((m) => normalizeRsn(m.rsn) !== key) }));
      if (to === POOL) return without;
      const was = prev.flatMap((t) => t.members).find((m) => normalizeRsn(m.rsn) === key);
      return without.map((t, i) => (String(i) === to ? { ...t, members: [...t.members, { rsn, is_captain: was?.is_captain ?? false }] } : t));
    });
    if (to === POOL && !data.signups.some((s) => normalizeRsn(s.rsn) === key)) setExtraPool((p) => [...p, rsn]);
    setSelected(null);
  };

  const addToPool = (names: string[]) => {
    const canonical = names.map((raw) => roster.find((r) => normalizeRsn(r) === normalizeRsn(raw)) ?? raw);
    setExtraPool((p) => [...p, ...canonical.filter((r) => !placed.has(normalizeRsn(r)))]);
  };

  const everyone = () => [...teams.flatMap((t) => t.members.map((m) => m.rsn)), ...pool];

  const balance = async () => {
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/admin/bingo/${event.id}/teams/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsns: everyone(), teamCount: teams.length }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNotice({ ok: false, text: json.error ?? "Couldn't balance the teams." });
    const captains = new Set(teams.flatMap((t) => t.members.filter((m) => m.is_captain).map((m) => normalizeRsn(m.rsn))));
    update((prev) => prev.map((t, i) => ({ ...t, members: (json.teams[i]?.rsns ?? []).map((rsn: string) => ({ rsn, is_captain: captains.has(normalizeRsn(rsn)) })) })));
    setExtraPool([]);
    setHours(json.hours ?? {});
    setNotice({
      ok: true,
      text: `Balanced by efficient hours (EHP + EHB).${json.missing?.length ? ` No Wise Old Man data for ${json.missing.join(", ")}, so they count as 0.` : ""} Save to keep it.`,
    });
  };

  const randomise = () => {
    const all = shuffled(everyone());
    update((prev) => prev.map((t, i) => ({ ...t, members: all.filter((_, k) => k % prev.length === i).map((rsn) => ({ rsn, is_captain: false })) })));
    setExtraPool([]);
  };

  const save = async () => {
    setBusy(true);
    const res = await fetch(`/api/admin/bingo/${event.id}/teams`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teams }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNotice({ ok: false, text: json.error ?? "Couldn't save the teams." });
    setTeams((prev) => prev.map((t, i) => ({ ...t, id: json.teamIds?.[i] ?? t.id })));
    setDirty(false);
    setNotice({ ok: true, text: "Teams saved." });
    await onSaved();
  };

  const toggleSignups = async () => {
    setBusy(true);
    await fetch(`/api/admin/bingo/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: event.status === "signups" ? "draft" : "signups" }),
    });
    setBusy(false);
    await onSaved();
  };

  const suggestions = query.trim().length >= 1 ? roster.filter((r) => r.toLowerCase().includes(query.trim().toLowerCase()) && !placed.has(normalizeRsn(r)) && !pool.includes(r)).slice(0, 8) : [];

  const chip = (m: Member | string, from: string) => {
    const rsn = typeof m === "string" ? m : m.rsn;
    const captain = typeof m !== "string" && m.is_captain;
    const teamIndex = from === POOL ? -1 : Number(from);
    return (
      <div
        key={rsn}
        draggable
        onDragStart={() => setDrag(rsn)}
        onDragEnd={() => setDrag(null)}
        className={`group flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-mono bg-parchment cursor-grab ${selected === rsn ? "border-gnome-green ring-2 ring-gnome-green/40" : "border-bark-brown-light/40"}`}
      >
        <button type="button" onClick={() => setSelected(selected === rsn ? null : rsn)} className="flex-1 min-w-0 text-left truncate cursor-pointer text-bark-brown" title={notes.get(normalizeRsn(rsn)) ?? undefined}>
          {captain && <span title="Captain">★ </span>}
          {rsn}
          {notes.get(normalizeRsn(rsn)) && <span className="text-iron-grey"> ✎</span>}
        </button>
        {hours[rsn] != null && <span className="text-iron-grey">{hours[rsn]}h</span>}
        {teamIndex >= 0 && (
          <button
            type="button"
            aria-label={captain ? `Remove ${rsn} as captain` : `Make ${rsn} captain`}
            title={captain ? "Remove as captain" : "Make captain"}
            onClick={() =>
              update((prev) => prev.map((t, i) => (i === teamIndex ? { ...t, members: t.members.map((x) => (x.rsn === rsn ? { ...x, is_captain: !x.is_captain } : x)) } : t)))
            }
            className="text-gold opacity-40 group-hover:opacity-100 cursor-pointer"
          >
            {captain ? "★" : "☆"}
          </button>
        )}
      </div>
    );
  };

  const column = (key: string, header: React.ReactNode, members: (Member | string)[], footer?: React.ReactNode) => (
    <div
      onDragOver={(e) => drag && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (drag) move(drag, key);
        setDrag(null);
      }}
      className={`rounded-lg border p-2.5 space-y-2 min-h-32 ${drag ? "border-dashed border-gnome-green/60" : "border-bark-brown-light/40"} bg-parchment-dark/30`}
    >
      {header}
      {selected && !members.some((m) => (typeof m === "string" ? m : m.rsn) === selected) && (
        <button type="button" onClick={() => move(selected, key)} className="w-full text-xs rounded-md border border-dashed border-gnome-green text-gnome-green py-1 cursor-pointer hover:bg-gnome-green/10">
          Move {selected} here
        </button>
      )}
      <div className="space-y-1">{members.map((m) => chip(m, key))}</div>
      {footer}
    </div>
  );

  return (
    <div className="space-y-5">
      <Card hover={false} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-bark-brown">Sign-ups</h2>
            <p className="text-sm text-iron-grey">
              {event.status === "signups"
                ? `Open: members see this bingo and a Join button, but not the tiles. ${data.signups.length} signed up.`
                : event.status === "draft"
                  ? "Open sign-ups to list this bingo and let members join. The tiles stay hidden until it goes live."
                  : `${data.signups.length} signed up before it went live.`}
            </p>
          </div>
          {(event.status === "draft" || event.status === "signups") && (
            <Button size="sm" variant={event.status === "signups" ? "ghost" : "primary"} disabled={busy} onClick={toggleSignups}>
              {event.status === "signups" ? "Close sign-ups (back to draft)" : "Open sign-ups"}
            </Button>
          )}
        </div>
      </Card>

      <Card hover={false} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-bark-brown">Teams</h2>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" disabled={busy || teams.length < 2} onClick={balance}>
              {busy ? "Working..." : "Balance teams"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={randomise}>
              Randomise
            </Button>
            <Button size="sm" variant="ghost" disabled={teams.length >= 12} onClick={() => update((p) => [...p, { name: TEAM_NAMES[p.length % TEAM_NAMES.length], color: TEAM_COLORS[p.length % TEAM_COLORS.length], members: [] }])}>
              + Add team
            </Button>
          </div>
        </div>
        <p className="text-xs text-iron-grey">
          Balance spreads everyone (placed and waiting) across the teams by Wise Old Man efficient hours. Drag players between columns, or click a name and then &quot;Move here&quot;. ☆ marks a captain.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {column(
            POOL,
            <div>
              <p className="text-sm font-semibold text-bark-brown">Waiting ({pool.length})</p>
              <p className="text-[11px] text-iron-grey">Signed up or added, not on a team yet.</p>
            </div>,
            pool,
            <div className="space-y-1.5 pt-1">
              <div className="relative">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add from the clan..." aria-label="Add a player from the clan list" className={`${inputClass} py-1 text-xs`} />
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 z-10 card-wood py-1 shadow-xl max-h-48 overflow-y-auto">
                    {suggestions.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          addToPool([r]);
                          setQuery("");
                        }}
                        className="block w-full text-left px-3 py-1 text-xs font-mono text-bark-brown hover:bg-parchment-dark cursor-pointer"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setShowPaste((v) => !v)} className="text-[11px] text-gnome-green hover:underline cursor-pointer">
                {showPaste ? "Hide" : "Paste a list of names"}
              </button>
              {showPaste && (
                <>
                  <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} className={`${inputClass} text-xs font-mono`} placeholder={"One per line or comma-separated"} />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!paste.trim()}
                    onClick={() => {
                      addToPool(splitList(paste));
                      setPaste("");
                      setShowPaste(false);
                    }}
                  >
                    Add names
                  </Button>
                </>
              )}
            </div>
          )}

          {teams.map((team, i) =>
            column(
              String(i),
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input type="color" value={team.color} aria-label={`${team.name} colour`} onChange={(e) => update((p) => p.map((t, k) => (k === i ? { ...t, color: e.target.value } : t)))} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
                  <input value={team.name} maxLength={40} aria-label="Team name" onChange={(e) => update((p) => p.map((t, k) => (k === i ? { ...t, name: e.target.value } : t)))} className={`${inputClass} py-1 text-sm font-semibold`} />
                  {teams.length > 2 && (
                    <button type="button" aria-label={`Remove ${team.name}`} onClick={() => update((p) => p.filter((_, k) => k !== i))} className="text-red-accent text-xs cursor-pointer px-1">
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-iron-grey">
                  {team.members.length} {team.members.length === 1 ? "player" : "players"}
                  {Object.keys(hours).length > 0 && ` · ${team.members.reduce((s, m) => s + (hours[m.rsn] ?? 0), 0).toLocaleString()}h`}
                </p>
              </div>,
              team.members
            )
          )}
        </div>
        {event.status === "active" && <p className="text-xs text-gold">This board is live. Removing a team also removes its progress; moving players keeps everyone&apos;s progress where it is.</p>}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy || !dirty} onClick={save}>
          {dirty ? "Save teams" : "Teams saved"}
        </Button>
        <Button variant="ghost" disabled={dirty} onClick={onNext}>
          Next: launch
        </Button>
        {notice && <span className={`text-sm ${notice.ok ? "text-gnome-green" : "text-red-accent"}`}>{notice.text}</span>}
        {dirty && !notice && <span className="text-sm text-gold">Unsaved changes</span>}
      </div>
    </div>
  );
}
