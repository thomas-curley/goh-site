"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DIFFICULTIES, formatAmount, metricLabel, metricMeasure, type BingoTile } from "@/lib/bingo";
import { TileIcon } from "@/components/bingo/TileFace";
import { ALL_METRICS, GROUP_LABEL, TilePicker, type PickedThing } from "./TilePicker";
import { Field, inputClass } from "./BasicsStep";

export type TileDraft = Omit<BingoTile, "id" | "position">;

export const BLANK_TILE: TileDraft = {
  title: "",
  description: null,
  points: 1,
  icon_kind: "none",
  icon_ref: null,
  icon_item_id: null,
  kind: "proof",
  required_count: 1,
  accepted_items: [],
  metric: null,
  target: null,
  auto_mode: "team_total",
};

const DEFAULT_TARGET = { skill: 1_000_000, boss: 50, activity: 10, computed: 10 } as const;

/** "Vorkath 50 KC", "1M Woodcutting XP", "10 Clue Scrolls (hard)". */
export function autoTitle(metric: string, target: number): string {
  const name = metricLabel(metric);
  const unit = metricMeasure(metric);
  if (unit === "XP") return `${formatAmount(target)} ${name} XP`;
  if (unit === "KC") return `${name} ${formatAmount(target)} KC`;
  if (unit === "hours") return `${formatAmount(target)} ${name}`;
  return `${formatAmount(target)} ${name}`;
}

function groupOf(metric: string) {
  return ALL_METRICS.find((m) => m.metric === metric)?.group ?? "skill";
}

/** The side panel for one square: what it's about, how it's checked, and how much it's worth. */
export function TileEditor({
  position,
  tile,
  live,
  onSave,
  onClear,
}: {
  position: number;
  tile: BingoTile | null;
  live: boolean;
  onSave: (draft: TileDraft) => Promise<string | null>;
  onClear: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<TileDraft>(tile ?? BLANK_TILE);
  const [titleTouched, setTitleTouched] = useState(!!tile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const set = (patch: Partial<TileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setMessage(null);
  };

  const applyPick = (thing: PickedThing) => {
    if (thing.type === "metric") {
      const target = DEFAULT_TARGET[thing.group];
      set({
        kind: "auto",
        metric: thing.metric,
        target,
        icon_kind: "metric",
        icon_ref: thing.metric,
        icon_item_id: null,
        ...(titleTouched && draft.title ? {} : { title: autoTitle(thing.metric, target) }),
      });
    } else {
      set({
        kind: "proof",
        metric: null,
        target: null,
        icon_kind: "item",
        icon_ref: thing.name,
        icon_item_id: thing.id,
        ...(titleTouched && draft.title ? {} : { title: thing.name }),
      });
    }
  };

  const setTarget = (target: number) => {
    set({ target, ...(!titleTouched && draft.metric ? { title: autoTitle(draft.metric, target) } : {}) });
  };

  const save = async () => {
    setSaving(true);
    const error = await onSave(draft);
    setSaving(false);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: "Saved." });
  };

  const isPreset = DIFFICULTIES.some((d) => d.points === draft.points);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-iron-grey">Square {position + 1}</p>
        {draft.title && (
          <span className="flex items-center gap-1.5 text-xs text-iron-grey min-w-0">
            <TileIcon tile={draft} className="w-5 h-5" />
            <span className="truncate">{draft.title}</span>
          </span>
        )}
      </div>

      <Field label="What do they need to get?" hint="Pick from the list and the name, icon and tracking fill in. You can change any of it after.">
        <TilePicker onPick={applyPick} />
      </Field>

      <Field label="Tile name">
        <input
          value={draft.title}
          maxLength={80}
          onChange={(e) => {
            setTitleTouched(true);
            set({ title: e.target.value });
          }}
          className={inputClass}
          placeholder="e.g. Any Zenyte jewellery"
        />
      </Field>

      <Field label="How it's checked">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["proof", "Screenshot proof", "A player sends a screenshot; staff approve it."],
              ["auto", "Wise Old Man", "Counts XP or KC gained during the event."],
            ] as const
          ).map(([kind, title, text]) => (
            <button
              key={kind}
              type="button"
              onClick={() => set(kind === "auto" ? { kind, metric: draft.metric ?? "vorkath", target: draft.target ?? 50 } : { kind })}
              className={`text-left rounded-md border p-2.5 cursor-pointer ${draft.kind === kind ? "border-gnome-green bg-gnome-green/10" : "border-bark-brown-light/40 hover:bg-parchment-dark/40"}`}
            >
              <span className="block text-sm font-semibold text-bark-brown">{title}</span>
              <span className="block text-[11px] text-iron-grey leading-snug">{text}</span>
            </button>
          ))}
        </div>
      </Field>

      {draft.kind === "proof" ? (
        <>
          <Field label="How many are needed" hint="More than 1 makes a count tile: each approved screenshot adds to it (e.g. 2 whips, 3 Barrows pieces).">
            <input type="number" min={1} max={1000} value={draft.required_count} onChange={(e) => set({ required_count: Math.max(1, Number(e.target.value) || 1) })} className={`${inputClass} w-28`} />
          </Field>
          <Field label="Items that count (optional)" hint="For 'any of these' tiles. Shown to players as a checklist. Drops of these items from the clan feed (DropTracker) count automatically, if the bingo allows it.">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {draft.accepted_items.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gnome-green/10 text-gnome-green">
                  {name}
                  <button type="button" aria-label={`Remove ${name}`} onClick={() => set({ accepted_items: draft.accepted_items.filter((n) => n !== name) })} className="text-red-accent cursor-pointer">
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <TilePicker
              placeholder="Add an item..."
              onPick={(t) => {
                const name = t.type === "item" ? t.name : metricLabel(t.metric);
                if (!draft.accepted_items.includes(name)) set({ accepted_items: [...draft.accepted_items, name] });
              }}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="What's tracked">
            <select
              value={draft.metric ?? ""}
              onChange={(e) => {
                const metric = e.target.value;
                const target = DEFAULT_TARGET[groupOf(metric)];
                set({ metric, target, icon_kind: "metric", icon_ref: metric, icon_item_id: null, ...(!titleTouched ? { title: autoTitle(metric, target) } : {}) });
              }}
              className={`${inputClass} cursor-pointer`}
            >
              {(["boss", "skill", "activity", "computed"] as const).map((g) => (
                <optgroup key={g} label={GROUP_LABEL[g]}>
                  {ALL_METRICS.filter((m) => m.group === g).map((m) => (
                    <option key={m.metric} value={m.metric}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label={`Amount to gain${draft.metric && metricMeasure(draft.metric) ? ` (${metricMeasure(draft.metric)})` : ""}`} hint={draft.target ? `Shown as ${formatAmount(draft.target)}.` : undefined}>
            <input type="number" min={1} value={draft.target ?? ""} onChange={(e) => setTarget(Number(e.target.value))} className={`${inputClass} w-40`} />
          </Field>
          <Field label="Who counts">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["team_total", "Whole team adds up"],
                  ["single_player", "One player must do it all"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set({ auto_mode: mode })}
                  className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${draft.auto_mode === mode ? "border-gnome-green bg-gnome-green text-text-light" : "border-bark-brown-light/50 text-bark-brown hover:bg-parchment-dark"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}

      <Field label="Difficulty">
        <div className="flex flex-wrap items-center gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => set({ points: d.points })}
              className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${draft.points === d.points ? "border-gnome-green bg-gnome-green text-text-light" : "border-bark-brown-light/50 text-bark-brown hover:bg-parchment-dark"}`}
            >
              {d.label} · {d.points}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-iron-grey">
            or
            <input
              type="number"
              min={0}
              max={100}
              aria-label="Custom points"
              value={draft.points}
              onChange={(e) => set({ points: Math.max(0, Number(e.target.value) || 0) })}
              className={`${inputClass} w-16 py-1 ${isPreset ? "" : "ring-2 ring-gnome-green"}`}
            />
            points
          </label>
        </div>
      </Field>

      <Field label="Notes for players (optional)">
        <textarea
          value={draft.description ?? ""}
          rows={2}
          maxLength={600}
          onChange={(e) => set({ description: e.target.value || null })}
          className={inputClass}
          placeholder="e.g. Must be from the Corrupted Gauntlet. Show the loot message."
        />
      </Field>

      {live && <p className="text-xs text-gold">This board is live. Changes show to members straight away, and a changed goal can complete (or reopen) the tile for a team.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={saving || !draft.title.trim()} onClick={save}>
          {saving ? "Saving..." : tile ? "Save tile" : "Add tile"}
        </Button>
        {tile &&
          (confirmClear ? (
            <>
              <Button size="sm" variant="ghost" className="text-red-accent" onClick={onClear}>
                {live ? "Yes, remove it and its progress" : "Yes, clear it"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
              Clear square
            </Button>
          ))}
        {message && <span className={`text-sm ${message.ok ? "text-gnome-green" : "text-red-accent"}`}>{message.text}</span>}
      </div>
    </div>
  );
}
