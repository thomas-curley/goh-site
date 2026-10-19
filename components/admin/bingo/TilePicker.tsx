"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ACTIVITIES, BOSSES, COMPUTED_METRICS, SKILLS } from "@wise-old-man/utils";
import { metricIconUrl, metricLabel } from "@/lib/bingo";
import { itemIconUrl } from "@/lib/osrs-character";
import { inputClass } from "./BasicsStep";

export type PickedThing =
  | { type: "item"; name: string; id: number | null }
  | { type: "metric"; metric: string; group: "skill" | "boss" | "activity" | "computed" };

const METRICS: { metric: string; group: "skill" | "boss" | "activity" | "computed"; name: string }[] = [
  ...[...SKILLS].filter((m) => m !== "overall").map((m) => ({ metric: m, group: "skill" as const, name: metricLabel(m) })),
  ...[...BOSSES].map((m) => ({ metric: m, group: "boss" as const, name: metricLabel(m) })),
  ...[...ACTIVITIES].map((m) => ({ metric: m, group: "activity" as const, name: metricLabel(m) })),
  ...[...COMPUTED_METRICS].map((m) => ({ metric: m, group: "computed" as const, name: metricLabel(m) })),
];

export const GROUP_LABEL = { skill: "Skill XP", boss: "Boss KC", activity: "Activity", computed: "Efficiency" } as const;

/** Every trackable metric, for the builder's metric dropdown. */
export const ALL_METRICS = METRICS;

/**
 * One search box for anything a tile can be about: items (from the wiki's
 * item list, with icons) and skills, bosses and activities (tracked
 * automatically). Untradeable items aren't in that list, so any text can
 * also be used as an item name; the icon then comes from the wiki by name.
 */
export function TilePicker({ onPick, placeholder = "Search an item, boss, skill or clue..." }: { onPick: (thing: PickedThing) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ id: number; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    timer.current = setTimeout(() => {
      if (query.length < 2) return setItems([]);
      fetch(`/api/items/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setItems((d.items ?? []).slice(0, 8)))
        .catch(() => setItems([]));
    }, 200);
  }, [q]);

  const metrics = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    return METRICS.filter((m) => m.name.toLowerCase().includes(query) || m.metric.includes(query.replace(/\s+/g, "_"))).slice(0, 6);
  }, [q]);

  const options: { key: string; thing: PickedThing; label: string; sub: string; icon: string | null }[] = [
    ...metrics.map((m) => ({ key: `m:${m.metric}`, thing: { type: "metric" as const, metric: m.metric, group: m.group }, label: m.name, sub: `${GROUP_LABEL[m.group]} · tracked automatically`, icon: metricIconUrl(m.metric) })),
    ...items.map((i) => ({ key: `i:${i.id}`, thing: { type: "item" as const, name: i.name, id: i.id }, label: i.name, sub: "Item · screenshot proof", icon: itemIconUrl(i.id) })),
    ...(q.trim().length >= 2 && !items.some((i) => i.name.toLowerCase() === q.trim().toLowerCase())
      ? [{ key: "free", thing: { type: "item" as const, name: q.trim(), id: null }, label: `Use "${q.trim()}"`, sub: "For pets, capes and other untradeables · screenshot proof", icon: null }]
      : []),
  ];

  const pick = (thing: PickedThing) => {
    onPick(thing);
    setQ("");
    setOpen(false);
    setActive(0);
  };

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return;
          if (e.key === "ArrowDown") setActive((a) => Math.min(options.length - 1, a + 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
          else if (e.key === "Enter") pick(options[active].thing);
          else return;
          e.preventDefault();
        }}
        placeholder={placeholder}
        aria-label="Search for what the tile is about"
        autoComplete="off"
        className={inputClass}
      />
      {open && options.length > 0 && (
        <ul className="absolute left-0 right-0 mt-1 z-20 card-wood py-1 shadow-xl max-h-80 overflow-y-auto" role="listbox">
          {options.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={() => pick(o.thing)}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left cursor-pointer ${i === active ? "bg-parchment-dark" : ""}`}
              >
                <span className="w-7 h-7 shrink-0 flex items-center justify-center">
                  {o.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.icon} alt="" className="max-w-7 max-h-7 object-contain [image-rendering:pixelated]" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-bark-brown truncate">{o.label}</span>
                  <span className="block text-[11px] text-iron-grey">{o.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
