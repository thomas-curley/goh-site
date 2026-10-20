"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { eventQuests, STATUS_LABELS, type QuestCompletion, type QuestEvent, type QuestParticipant, type QuestTeam, type Standing } from "@/lib/quests";
import { STATUS_CHIP } from "@/components/admin/bingo/BingoBuilder";
import { QuestBasicsStep } from "./QuestBasicsStep";
import { QuestPickerStep } from "./QuestPickerStep";
import { QuestPlayersStep } from "./QuestPlayersStep";
import { QuestLaunchStep } from "./QuestLaunchStep";

export interface AdminQuestEvent {
  event: QuestEvent;
  teams: QuestTeam[];
  participants: (QuestParticipant & { remaining: number | null })[];
  completions: QuestCompletion[];
  standings: Standing[];
  pendingCount: number;
  launchProblems: string[];
}

const STEPS = [
  { key: "basics", label: "Basics & scoring" },
  { key: "quests", label: "Quests" },
  { key: "players", label: "Players" },
  { key: "launch", label: "Launch" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

async function fetchEvent(id: string) {
  const res = await fetch(`/api/admin/quests/${id}`);
  return { ok: res.ok, json: await res.json().catch(() => ({})) };
}

/** The staff side of one quest event: settings, quest list, players and launch, as steps that save as you go. */
export function QuestBuilder({ id }: { id: string }) {
  const [data, setData] = useState<AdminQuestEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>("basics");
  const opened = useRef(false);

  const apply = useCallback((res: { ok: boolean; json: AdminQuestEvent & { error?: string } }) => {
    if (!res.ok) return setError(res.json.error ?? "Couldn't load this event.");
    setData(res.json);
    if (opened.current) return;
    opened.current = true;
    if (res.json.event.status === "active" || res.json.event.status === "completed") setStep("launch");
  }, []);

  const reload = useCallback(async () => apply(await fetchEvent(id)), [id, apply]);

  useEffect(() => {
    let cancelled = false;
    fetchEvent(id).then((res) => !cancelled && apply(res));
    return () => {
      cancelled = true;
    };
  }, [id, apply]);

  if (!data) return <p className="text-sm text-iron-grey py-10 text-center">{error ?? "Loading..."}</p>;
  const { event } = data;
  const questCount = eventQuests(event).length;
  const done: Record<StepKey, boolean> = {
    basics: !!event.ends_at,
    quests: questCount > 0,
    players: data.participants.length > 0 && (event.format === "solo" || (data.teams.length >= 2 && data.participants.every((p) => p.team_id))),
    launch: event.status === "active" || event.status === "completed",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/quests" className="text-xs text-gnome-green hover:underline">← All quest events</Link>
          <h1 className="font-display text-3xl text-gnome-green break-words">{event.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_CHIP[event.status]}`}>{STATUS_LABELS[event.status]}</span>
            <span className="text-iron-grey">
              {event.format === "teams" ? `Teams · ${data.teams.length} teams` : "Solo"} · {questCount} quests · {data.participants.length} players
            </span>
            {data.pendingCount > 0 && (
              <Link href={`/admin/quests/submissions?event=${event.id}`} className="px-2 py-0.5 rounded-full bg-gold/15 text-gold font-semibold hover:underline">
                {data.pendingCount} to review
              </Link>
            )}
          </div>
        </div>
        <Link href={`/quests/${event.id}`} target="_blank" className="text-sm text-gnome-green hover:underline shrink-0">
          {event.status === "draft" ? "Preview as a member ↗" : "Open member page ↗"}
        </Link>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Quest event setup steps">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(s.key)}
            aria-current={step === s.key ? "step" : undefined}
            className={`px-3.5 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
              step === s.key ? "bg-gnome-green text-text-light font-semibold" : done[s.key] ? "bg-gnome-green/10 text-gnome-green hover:bg-gnome-green/20" : "bg-parchment-dark text-bark-brown hover:bg-parchment-dark/70"
            }`}
          >
            {done[s.key] && step !== s.key ? "✓ " : `${i + 1}. `}
            {s.label}
          </button>
        ))}
      </nav>

      {step === "basics" && <QuestBasicsStep data={data} onSaved={reload} onNext={() => setStep("quests")} />}
      {step === "quests" && <QuestPickerStep data={data} onSaved={reload} onNext={() => setStep("players")} />}
      {step === "players" && <QuestPlayersStep key={`${data.event.format}-${data.participants.length}`} data={data} onSaved={reload} onNext={() => setStep("launch")} />}
      {step === "launch" && <QuestLaunchStep data={data} onChanged={reload} goTo={(s) => setStep(s as StepKey)} />}
    </div>
  );
}
