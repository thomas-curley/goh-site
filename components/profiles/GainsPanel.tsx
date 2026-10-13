"use client";

import { useState } from "react";

export interface GainRow {
  name: string;
  gained: number;
  /** "xp" or "kc" -- how the number is labelled. */
  unit: "xp" | "kc";
}

export interface GainsSet {
  skills: GainRow[];
  bosses: GainRow[];
  ehp: number;
  ehb: number;
}

function formatGain(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}

function Bars({ rows, empty }: { rows: GainRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-iron-grey">{empty}</p>;
  const max = rows[0].gained;
  return (
    <ol className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-2 text-sm">
          <span className="truncate text-bark-brown">{r.name}</span>
          <span className="h-2.5 rounded-full bg-parchment-dark/60 overflow-hidden">
            <span className="block h-full rounded-full bg-gnome-green" style={{ width: `${Math.max(4, (r.gained / max) * 100)}%` }} />
          </span>
          <span className="text-right tabular-nums text-bark-brown">
            +{formatGain(r.gained)}
            <span className="text-[10px] text-iron-grey ml-0.5">{r.unit}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Top XP and kill-count gains over the last week or month. */
export function GainsPanel({ week, month }: { week: GainsSet | null; month: GainsSet | null }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const set = period === "week" ? week : month;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-md border border-bark-brown-light overflow-hidden text-xs font-semibold" role="group" aria-label="Gains period">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`px-3 py-1.5 cursor-pointer ${period === p ? "bg-gnome-green text-white" : "text-bark-brown hover:bg-parchment-dark"}`}
            >
              Last {p}
            </button>
          ))}
        </div>
        {set && (
          <p className="text-sm text-bark-brown">
            <span className="font-semibold tabular-nums">+{set.ehp.toFixed(1)}</span> EHP ·{" "}
            <span className="font-semibold tabular-nums">+{set.ehb.toFixed(1)}</span> EHB
          </p>
        )}
      </div>
      {!set ? (
        <p className="text-sm text-iron-grey">Couldn&apos;t load gains from Wise Old Man right now.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-iron-grey mb-2">Skills</h3>
            <Bars rows={set.skills} empty="No XP gained in this period." />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-iron-grey mb-2">Bosses</h3>
            <Bars rows={set.bosses} empty="No boss kills in this period." />
          </div>
        </div>
      )}
    </div>
  );
}
