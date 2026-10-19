"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { maxScore } from "@/lib/bingo";
import { useNow } from "@/components/bingo/Countdown";
import type { AdminBingo } from "./BingoBuilder";

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "not set";
}

export function LaunchStep({ data, onChanged, goTo }: { data: AdminBingo; onChanged: () => Promise<void>; goTo: (step: string) => void }) {
  const router = useRouter();
  const now = useNow();
  const { event, teams, tiles, standings } = data;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<"finish" | "delete" | "reopen" | null>(null);

  const setStatus = async (status: string) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/bingo/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      setProblems(json.problems ?? []);
      return setMessage({ ok: false, text: json.error ?? "Couldn't change the status." });
    }
    setProblems([]);
    setMessage({ ok: true, text: status === "active" ? "It's live! Members can see the board now." : status === "completed" ? "Finished. Final standings are posted on the board." : "Saved." });
    await onChanged();
  };

  const refresh = async () => {
    setBusy(true);
    const res = await fetch(`/api/admin/bingo/${event.id}/refresh`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(
      res.ok
        ? { ok: json.errors?.length === 0, text: json.errors?.length ? json.errors.join(" ") : `Updated ${json.tilesSynced} tracked ${json.tilesSynced === 1 ? "tile" : "tiles"} from Wise Old Man.` }
        : { ok: false, text: json.error ?? "Couldn't refresh." }
    );
    await onChanged();
  };

  const remove = async () => {
    setBusy(true);
    const res = await fetch(`/api/admin/bingo/${event.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.push("/admin/bingo");
    else setMessage({ ok: false, text: "Couldn't delete it." });
  };

  const checks = [
    { ok: tiles.length === event.grid_size * event.grid_size, text: `Board filled (${tiles.length}/${event.grid_size * event.grid_size})`, step: "board" },
    { ok: teams.length >= 2 && teams.every((t) => t.members.length > 0), text: `${teams.length} teams, each with players`, step: "teams" },
    { ok: !!event.ends_at, text: `Ends ${when(event.ends_at)}`, step: "basics" },
  ];
  const startsLater = event.starts_at && Date.parse(event.starts_at) > now;
  const hasAuto = tiles.some((t) => t.kind === "auto");

  return (
    <div className="space-y-5">
      {(event.status === "draft" || event.status === "signups") && (
        <Card hover={false} className="space-y-4">
          <h2 className="font-display text-xl text-bark-brown">Ready to go live?</h2>
          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.text} className="flex items-center gap-2 text-sm">
                <span className={c.ok ? "text-gnome-green" : "text-red-accent"} aria-hidden>
                  {c.ok ? "✓" : "✕"}
                </span>
                <span className="text-bark-brown">{c.text}</span>
                {!c.ok && (
                  <button type="button" onClick={() => goTo(c.step)} className="text-xs text-gnome-green hover:underline cursor-pointer">
                    Fix
                  </button>
                )}
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm text-iron-grey">
              <span aria-hidden>•</span>
              Starts {when(event.starts_at)}
              {startsLater ? " (the board unlocks for members then)" : event.starts_at ? "" : " (right away)"}
            </li>
          </ul>
          {problems.length > 0 && (
            <ul className="text-sm text-red-accent list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy || checks.some((c) => !c.ok)} onClick={() => setStatus("active")}>
              {startsLater ? "Go live (unlocks at the start time)" : "Go live now"}
            </Button>
            <Link href={`/bingo/${event.id}`} target="_blank" className="text-sm text-gnome-green hover:underline">
              Preview as a member ↗
            </Link>
          </div>
          <p className="text-xs text-iron-grey">Going live posts nothing on its own; completed tiles and lines are announced in the bingo Discord channel (Admin › Alert Channels).</p>
        </Card>
      )}

      {(event.status === "active" || event.status === "completed") && (
        <Card hover={false} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-bark-brown">Standings</h2>
            <span className="text-xs text-iron-grey">
              Out of {maxScore(event, tiles)} possible · {event.status === "active" ? `ends ${when(event.ends_at)}` : "final"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-iron-grey">
                  <th className="py-1 pr-3 font-medium">#</th>
                  <th className="py-1 pr-3 font-medium">Team</th>
                  <th className="py-1 pr-3 font-medium text-right">Points</th>
                  <th className="py-1 pr-3 font-medium text-right">Tiles</th>
                  <th className="py-1 pr-3 font-medium text-right">Lines</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {standings.map((s, i) => {
                  const team = teams.find((t) => t.id === s.teamId);
                  return (
                    <tr key={s.teamId} className="border-t border-bark-brown-light/20">
                      <td className="py-1.5 pr-3">{i + 1}</td>
                      <td className="py-1.5 pr-3">
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: team?.color ?? "#999" }} />
                        {team?.name}
                        {s.blackout && " 🏆"}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-semibold">{s.total}</td>
                      <td className="py-1.5 pr-3 text-right">{s.tilesDone}</td>
                      <td className="py-1.5 pr-3 text-right">{s.lines.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.pendingCount > 0 && (
              <Link href={`/admin/bingo/submissions?event=${event.id}`}>
                <Button size="sm">Review {data.pendingCount} {data.pendingCount === 1 ? "submission" : "submissions"}</Button>
              </Link>
            )}
            {event.status === "active" && hasAuto && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={refresh}>
                {busy ? "Refreshing..." : "Refresh tracked tiles now"}
              </Button>
            )}
            {event.last_synced_at && hasAuto && <span className="text-xs text-iron-grey">Last updated {when(event.last_synced_at)}</span>}
          </div>
          {event.status === "active" &&
            (confirm === "finish" ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-bark-brown">End the bingo now? Scores freeze and the results are posted.</span>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStatus("completed")}>
                  Yes, finish it
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                  Not yet
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setConfirm("finish")}>
                Finish and post results
              </Button>
            ))}
          {event.status === "completed" &&
            (confirm === "reopen" ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Reopen it as live?</span>
                <Button size="sm" disabled={busy} onClick={() => setStatus("active")}>
                  Reopen
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirm("reopen")}>
                Reopen as live
              </Button>
            ))}
        </Card>
      )}

      {message && <p className={`text-sm ${message.ok ? "text-gnome-green" : "text-red-accent"}`}>{message.text}</p>}

      <Card hover={false} className="space-y-2">
        <h2 className="font-display text-lg text-bark-brown">Delete</h2>
        {confirm === "delete" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-red-accent">This deletes the board, teams, submissions and progress for good.</span>
            <Button size="sm" variant="ghost" className="text-red-accent" disabled={busy} onClick={remove}>
              Delete {event.name}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="text-red-accent" onClick={() => setConfirm("delete")}>
            Delete this bingo
          </Button>
        )}
      </Card>
    </div>
  );
}
