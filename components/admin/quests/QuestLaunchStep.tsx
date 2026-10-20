"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/admin/bingo/BasicsStep";
import { useNow } from "@/components/bingo/Countdown";
import { eventQuests, questPoints, QUEST_BY_NAME } from "@/lib/quests";
import { WikiSyncBadge } from "./QuestPlayersStep";
import type { AdminQuestEvent } from "./QuestBuilder";

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "not set";
}

const SOURCE_LABEL = { wikisync: "WikiSync", proof: "Screenshot", staff: "Added by staff" } as const;

export function QuestLaunchStep({ data, onChanged, goTo }: { data: AdminQuestEvent; onChanged: () => Promise<void>; goTo: (step: string) => void }) {
  const router = useRouter();
  const now = useNow();
  const { event, teams, participants, completions, standings } = data;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<"finish" | "delete" | "reopen" | null>(null);
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);
  const [addQuest, setAddQuest] = useState("");

  const counted = eventQuests(event);
  const countedNames = new Set(counted.map((q) => q.name));

  const setStatus = async (status: string) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/quests/${event.id}`, {
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
    setMessage({ ok: true, text: status === "active" ? "It's live! Quests finished from the start time on will count." : status === "completed" ? "Finished. The results are posted." : "Saved." });
    await onChanged();
  };

  const refresh = async () => {
    setBusy(true);
    const res = await fetch(`/api/admin/quests/${event.id}/refresh`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(
      res.ok
        ? { ok: !json.errors?.length, text: `Checked ${json.checked} ${json.checked === 1 ? "player" : "players"} on WikiSync${event.status === "active" ? `, ${json.newQuests} new ${json.newQuests === 1 ? "quest" : "quests"}` : ""}.${json.errors?.length ? ` ${json.errors.length} couldn't be reached; try again in a bit.` : ""}` }
        : { ok: false, text: json.error ?? "Couldn't refresh." }
    );
    await onChanged();
  };

  const editCompletion = async (participantId: string, questName: string, add: boolean) => {
    setBusy(true);
    const res = await fetch(`/api/admin/quests/${event.id}/completions`, {
      method: add ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, questName }),
    });
    setBusy(false);
    if (!res.ok) setMessage({ ok: false, text: (await res.json().catch(() => ({}))).error ?? "Couldn't change that." });
    setAddQuest("");
    await onChanged();
  };

  const remove = async () => {
    setBusy(true);
    const res = await fetch(`/api/admin/quests/${event.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.push("/admin/quests");
    else setMessage({ ok: false, text: "Couldn't delete it." });
  };

  const checks = [
    { ok: !!event.ends_at, text: `Ends ${when(event.ends_at)}`, step: "basics" },
    { ok: counted.length > 0, text: `${counted.length} quests count`, step: "quests" },
    event.format === "teams"
      ? { ok: teams.length >= 2 && participants.every((p) => p.team_id), text: `${teams.length} teams, everyone placed`, step: "players" }
      : { ok: true, text: `${participants.length} players so far (members can keep joining)`, step: "players" },
  ];
  const startsLater = event.starts_at && Date.parse(event.starts_at) > now;
  const synced = participants.filter((p) => p.has_wikisync).length;
  const noSync = participants.filter((p) => p.has_wikisync === false);

  const playerRows = (ids: string[]) =>
    participants
      .filter((p) => ids.includes(p.id))
      .map((p) => {
        const mine = completions.filter((c) => c.participant_id === p.id && countedNames.has(c.quest_name));
        const open = openPlayer === p.id;
        return (
          <li key={p.id} className="py-1.5">
            <button type="button" onClick={() => setOpenPlayer(open ? null : p.id)} className="w-full flex items-center gap-2 text-left text-sm cursor-pointer">
              <span className="font-mono text-bark-brown flex-1 min-w-0 truncate">{p.rsn}</span>
              <WikiSyncBadge has={p.has_wikisync} checked={p.last_checked_at} />
              <span className="text-xs text-iron-grey tabular-nums w-20 text-right">{mine.length} quests</span>
              <span className="text-xs text-gnome-green">{open ? "Hide" : "Edit"}</span>
            </button>
            {open && (
              <div className="mt-2 ml-2 pl-3 border-l-2 border-parchment-dark space-y-2">
                {mine.length === 0 ? (
                  <p className="text-xs text-iron-grey">No quests counted yet.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {mine.map((c) => (
                      <li key={c.quest_name} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 text-bark-brown">{c.quest_name}</span>
                        <span className="text-iron-grey">{SOURCE_LABEL[c.source]}</span>
                        <span className="text-gnome-green tabular-nums">+{questPoints(event, QUEST_BY_NAME.get(c.quest_name)!)}</span>
                        <button type="button" disabled={busy} onClick={() => editCompletion(p.id, c.quest_name, false)} className="text-red-accent hover:underline cursor-pointer">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <select value={addQuest} onChange={(e) => setAddQuest(e.target.value)} aria-label="Quest to count" className={`${inputClass} py-1 text-xs sm:w-72 cursor-pointer`}>
                    <option value="">Count a quest by hand...</option>
                    {counted
                      .filter((q) => !mine.some((c) => c.quest_name === q.name))
                      .map((q) => (
                        <option key={q.name} value={q.name}>
                          {q.name}
                        </option>
                      ))}
                  </select>
                  <Button size="sm" variant="ghost" disabled={busy || !addQuest} onClick={() => editCompletion(p.id, addQuest, true)}>
                    Add
                  </Button>
                </div>
                <p className="text-[11px] text-iron-grey">A removed quest won&apos;t come back from WikiSync for this player.</p>
              </div>
            )}
          </li>
        );
      });

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
              {startsLater ? "" : event.starts_at ? "" : " (as soon as it goes live)"}
            </li>
            <li className="flex items-center gap-2 text-sm text-iron-grey">
              <span aria-hidden>•</span>
              {synced} of {participants.length} players have WikiSync{noSync.length > 0 && ` (${noSync.map((p) => p.rsn).join(", ")} will need screenshots)`}
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
              {startsLater ? "Go live (counts from the start time)" : "Go live now"}
            </Button>
            <Button variant="ghost" disabled={busy || participants.length === 0} onClick={refresh}>
              {busy ? "Checking..." : "Check WikiSync now"}
            </Button>
          </div>
          <p className="text-xs text-iron-grey">
            Everyone&apos;s starting point is their WikiSync quest list just before the start; anything finished after it scores. Each finished quest is posted in the quest events Discord channel (Admin › Discord Channels).
          </p>
        </Card>
      )}

      {(event.status === "active" || event.status === "completed") && (
        <Card hover={false} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-bark-brown">Standings</h2>
            <span className="text-xs text-iron-grey">{event.status === "active" ? `ends ${when(event.ends_at)}` : "final"}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-iron-grey">
                  <th className="py-1 pr-3 font-medium">#</th>
                  <th className="py-1 pr-3 font-medium">{event.format === "teams" ? "Team" : "Player"}</th>
                  <th className="py-1 pr-3 font-medium text-right">Points</th>
                  <th className="py-1 pr-3 font-medium text-right">Quests</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {standings.map((s, i) => (
                  <tr key={s.id} className="border-t border-bark-brown-light/20">
                    <td className="py-1.5 pr-3">{i + 1}</td>
                    <td className="py-1.5 pr-3">
                      {s.color && <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: s.color }} />}
                      {s.name}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-semibold">{s.points}</td>
                    <td className="py-1.5 pr-3 text-right">{s.quests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.pendingCount > 0 && (
              <Link href={`/admin/quests/submissions?event=${event.id}`}>
                <Button size="sm">Review {data.pendingCount} {data.pendingCount === 1 ? "screenshot" : "screenshots"}</Button>
              </Link>
            )}
            {event.status === "active" && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={refresh}>
                {busy ? "Checking..." : "Check WikiSync now"}
              </Button>
            )}
            {event.last_synced_at && <span className="text-xs text-iron-grey">Last checked {when(event.last_synced_at)}</span>}
          </div>
          {event.status === "active" &&
            (confirm === "finish" ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-bark-brown">End the event now? Scores freeze and the results are posted.</span>
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

      {participants.length > 0 && (
        <Card hover={false} className="space-y-3">
          <div>
            <h2 className="font-display text-xl text-bark-brown">Players&apos; quests</h2>
            <p className="text-xs text-iron-grey">Open a player to see what&apos;s counted and where it came from, or to add or remove a quest by hand.</p>
          </div>
          {event.format === "teams" ? (
            teams.map((t) => (
              <div key={t.id}>
                <p className="text-sm font-semibold text-bark-brown flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color ?? "#999" }} aria-hidden />
                  {t.name}
                </p>
                <ul className="divide-y divide-bark-brown-light/20">{playerRows(participants.filter((p) => p.team_id === t.id).map((p) => p.id))}</ul>
              </div>
            ))
          ) : (
            <ul className="divide-y divide-bark-brown-light/20">{playerRows(participants.map((p) => p.id))}</ul>
          )}
        </Card>
      )}

      <Card hover={false} className="space-y-2">
        <h2 className="font-display text-lg text-bark-brown">Delete</h2>
        {confirm === "delete" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-red-accent">This deletes the event, its players, screenshots and scores for good.</span>
            <Button size="sm" variant="ghost" className="text-red-accent" disabled={busy} onClick={remove}>
              Delete {event.name}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="text-red-accent" onClick={() => setConfirm("delete")}>
            Delete this event
          </Button>
        )}
      </Card>
    </div>
  );
}
