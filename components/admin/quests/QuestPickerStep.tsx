"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/admin/bingo/BasicsStep";
import { DIFFICULTIES, DIFFICULTY_COLOR, eventQuests, questPoints, QUESTS, wikiUrl, type Difficulty } from "@/lib/quests";
import { ChoiceCard } from "./QuestBasicsStep";
import type { AdminQuestEvent } from "./QuestBuilder";

const seriesName = (s: string | null) => (s ? s.replace(/\s*#\d+$/, "") : null);
const ALL_SERIES = [...new Set(QUESTS.map((q) => seriesName(q.series)).filter((s): s is string => !!s))].sort();

export function QuestPickerStep({ data, onSaved, onNext }: { data: AdminQuestEvent; onSaved: () => Promise<void>; onNext: () => void }) {
  const { event } = data;
  const [mode, setMode] = useState<"all" | "pick">(event.quest_names.length ? "pick" : "all");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(event.quest_names));
  const [miniquests, setMiniquests] = useState(event.include_miniquests);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [series, setSeries] = useState("");
  const [membership, setMembership] = useState<"" | "f2p" | "members">("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const touch = () => {
    setDirty(true);
    setStatus(null);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return QUESTS.filter(
      (x) =>
        (!q || x.name.toLowerCase().includes(q)) &&
        (!difficulty || x.difficulty === difficulty) &&
        (!series || seriesName(x.series) === series) &&
        (!membership || (membership === "members") === x.members) &&
        (!onlyPicked || picked.has(x.name))
    );
  }, [query, difficulty, series, membership, onlyPicked, picked]);

  const draft = { ...event, quest_names: mode === "all" ? [] : [...picked], include_miniquests: miniquests };
  const counted = mode === "pick" && picked.size === 0 ? [] : eventQuests(draft);
  const total = counted.reduce((s, q) => s + questPoints(event, q), 0);

  const toggle = (name: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    touch();
  };
  const bulk = (on: boolean) => {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const q of shown) {
        if (on) next.add(q.name);
        else next.delete(q.name);
      }
      return next;
    });
    touch();
  };

  const save = async (andNext = false) => {
    if (mode === "pick" && picked.size === 0) return setStatus({ ok: false, text: "Pick at least one quest, or count every quest." });
    setSaving(true);
    const res = await fetch(`/api/admin/quests/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quest_names: mode === "all" ? [] : [...picked], include_miniquests: miniquests }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setStatus({ ok: false, text: json.error ?? "Couldn't save." });
    setDirty(false);
    await onSaved();
    setStatus({ ok: true, text: "Saved." });
    if (andNext) onNext();
  };

  return (
    <div className="space-y-5">
      <Card hover={false} className="space-y-3">
        <h2 className="font-display text-xl text-bark-brown">Which quests count?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard name="mode" checked={mode === "all"} onPick={() => (setMode("all"), touch())} title="Every quest" text="Any quest finished during the event scores. New quests are added as the list updates." />
          <ChoiceCard name="mode" checked={mode === "pick"} onPick={() => (setMode("pick"), touch())} title="A list you pick" text="Only the quests you tick below score. Good for a themed event (a series, or one difficulty)." />
        </div>
        <label className="flex items-start gap-2 text-sm text-bark-brown cursor-pointer">
          <input type="checkbox" checked={miniquests} onChange={(e) => (setMiniquests(e.target.checked), touch())} className="accent-gnome-green mt-1" disabled={mode === "pick"} />
          <span>
            Count miniquests too
            <span className="block text-xs text-iron-grey">{mode === "pick" ? "With your own list, tick any miniquests you want below." : "Like Barbarian Training and Lair of Tarn Razorlor."}</span>
          </span>
        </label>
        <p className="text-sm text-bark-brown">
          <span className="font-semibold">{counted.length}</span> quests count, worth <span className="font-semibold">{total.toLocaleString()}</span> points in total.
        </p>
      </Card>

      {mode === "pick" && (
        <Card hover={false} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search quests..." aria-label="Search quests" className={`${inputClass} sm:w-56`} />
            <select value={series} onChange={(e) => setSeries(e.target.value)} aria-label="Quest series" className={`${inputClass} sm:w-48 cursor-pointer`}>
              <option value="">Any series</option>
              {ALL_SERIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={membership} onChange={(e) => setMembership(e.target.value as typeof membership)} aria-label="Free or members" className={`${inputClass} sm:w-48 cursor-pointer`}>
              <option value="">F2P and members</option>
              <option value="f2p">Free-to-play only</option>
              <option value="members">Members only</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setDifficulty(null)} className={`px-2.5 py-1 rounded-full text-xs cursor-pointer ${!difficulty ? "bg-gnome-green text-text-light font-semibold" : "bg-parchment-dark text-bark-brown"}`}>
              All difficulties
            </button>
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(difficulty === d ? null : d)}
                className={`px-2.5 py-1 rounded-full text-xs cursor-pointer flex items-center gap-1 ${difficulty === d ? "bg-gnome-green text-text-light font-semibold" : "bg-parchment-dark text-bark-brown"}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: DIFFICULTY_COLOR[d] }} aria-hidden />
                {d}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-bark-brown ml-auto cursor-pointer">
              <input type="checkbox" checked={onlyPicked} onChange={(e) => setOnlyPicked(e.target.checked)} className="accent-gnome-green" />
              Only picked ({picked.size})
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-iron-grey">{shown.length} shown</span>
            <button type="button" onClick={() => bulk(true)} className="text-gnome-green hover:underline cursor-pointer">
              Tick all shown
            </button>
            <button type="button" onClick={() => bulk(false)} className="text-red-accent hover:underline cursor-pointer">
              Untick all shown
            </button>
          </div>
          <ul className="divide-y divide-bark-brown-light/20 max-h-[32rem] overflow-y-auto rounded-md border border-bark-brown-light/30">
            {shown.map((q) => (
              <li key={q.name}>
                <label className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${picked.has(q.name) ? "bg-gnome-green/5" : "hover:bg-parchment-dark/40"}`}>
                  <input type="checkbox" checked={picked.has(q.name)} onChange={() => toggle(q.name)} className="accent-gnome-green" />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DIFFICULTY_COLOR[q.difficulty] }} title={q.difficulty} />
                  <span className="flex-1 min-w-0">
                    <span className="text-bark-brown">{q.name}</span>
                    {q.miniquest && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-iron-grey">miniquest</span>}
                    <span className="block text-[11px] text-iron-grey">
                      {q.difficulty} · {q.qp} QP{q.length ? ` · ${q.length}` : ""}
                      {!q.members && " · F2P"}
                      {q.series && ` · ${q.series}`}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-gnome-green font-semibold shrink-0">{questPoints(event, q)} pts</span>
                  <a href={wikiUrl(q)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-iron-grey hover:text-gnome-green shrink-0" aria-label={`${q.name} on the wiki`}>
                    Wiki ↗
                  </a>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-iron-grey">No quests match.</li>}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={saving} onClick={() => save(true)}>
          {saving ? "Saving..." : "Save and add players"}
        </Button>
        <Button variant="ghost" disabled={saving || !dirty} onClick={() => save(false)}>
          Save
        </Button>
        {status && <span className={`text-sm ${status.ok ? "text-gnome-green" : "text-red-accent"}`}>{status.text}</span>}
        {dirty && !status && <span className="text-sm text-gold">Unsaved changes</span>}
      </div>
    </div>
  );
}
