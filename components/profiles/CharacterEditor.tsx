"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { EquipmentPanel, ItemIcon } from "@/components/profiles/EquipmentPanel";
import {
  BODY_PARTS,
  COLOUR_COUNTS,
  COLOUR_LABELS,
  SLOT_IDS,
  colourSwatch,
  defaultLook,
  hslToCss,
  kitOptions,
  type Character,
  type CharacterGear,
  type CharacterLook,
} from "@/lib/osrs-character";
import { loadOsrsData, type OsrsData } from "@/lib/osrs-data";
import { SLOT_LABELS, type EquipmentSlot } from "@/lib/profiles-format";

const CharacterViewer = dynamic(() => import("@/components/profiles/CharacterViewer").then((m) => m.CharacterViewer), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

const PART_LABELS = ["Hair", "Beard", "Torso", "Arms", "Hands", "Legs", "Feet"];

interface Own {
  look: CharacterLook | null;
  gear: CharacterGear;
}

function Stepper({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (v: number) => void }) {
  const index = Math.max(options.indexOf(value), 0);
  const step = (d: number) => onChange(options[(index + d + options.length) % options.length]);
  const shown = value === -1 ? "None" : `${index + 1 - (options[0] === -1 ? 1 : 0)} of ${options.length - (options[0] === -1 ? 1 : 0)}`;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-bark-brown w-16">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => step(-1)} aria-label={`Previous ${label.toLowerCase()}`} className="w-8 h-8 rounded-md border border-bark-brown-light/50 text-bark-brown hover:bg-parchment-dark cursor-pointer">
          ‹
        </button>
        <span className="w-20 text-center text-sm tabular-nums text-bark-brown-light">{shown}</span>
        <button type="button" onClick={() => step(1)} aria-label={`Next ${label.toLowerCase()}`} className="w-8 h-8 rounded-md border border-bark-brown-light/50 text-bark-brown hover:bg-parchment-dark cursor-pointer">
          ›
        </button>
      </div>
    </div>
  );
}

function ItemPicker({ data, slot, current, onPick }: { data: OsrsData; slot: EquipmentSlot; current: number | null; onPick: (id: number, name: string) => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const slotId = SLOT_IDS[slot];
    return data.itemList
      .filter((i) => i.slot === slotId && i.name.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.length - b.name.length || a.id - b.id)
      .slice(0, 60);
  }, [data, slot, query]);
  const nameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results) counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
    return counts;
  }, [results]);

  return (
    <div className="space-y-2">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${SLOT_LABELS[slot].toLowerCase()} items...`}
        aria-label="Search items"
        className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green"
      />
      {query.trim().length >= 2 && results.length === 0 && <p className="text-xs text-iron-grey">No {SLOT_LABELS[slot].toLowerCase()} items match.</p>}
      {results.length > 0 && (
        <ul className="max-h-72 overflow-y-auto rounded-md border border-bark-brown-light/40 p-1">
          {results.map((item, i) => {
            const variant = (nameCounts.get(item.name) ?? 0) > 1 ? results.slice(0, i + 1).filter((r) => r.name === item.name).length : 0;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item.id, item.name)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-bark-brown hover:bg-parchment-dark cursor-pointer ${current === item.id ? "bg-gnome-green/10" : ""}`}
                >
                  <span className="w-9 h-8 flex items-center justify-center shrink-0 rounded" style={{ background: "#5b4e3c" }}>
                    <ItemIcon item={item} className="max-w-8 max-h-7" />
                  </span>
                  <span className="min-w-0 truncate">{item.name}</span>
                  {variant > 0 && <span className="ml-auto shrink-0 text-[11px] text-iron-grey">variant {variant}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Builds an OSRS character in 3D: body type, body-part styles and colours
 * (like the in-game character creator), plus gear for each slot.
 * `mode="member"` edits the signed-in member's character, where anything
 * left unset uses the clan default; `mode="default"` edits that default.
 */
export function CharacterEditor({ mode }: { mode: "member" | "default" }) {
  const endpoint = mode === "member" ? "/api/account/outfit" : "/api/admin/profile-default-outfit";
  const [own, setOwn] = useState<Own>({ look: null, gear: {} });
  const [fallback, setFallback] = useState<Character>({ look: defaultLook(), gear: {} });
  const [data, setData] = useState<OsrsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"look" | "gear">("look");
  const [slot, setSlot] = useState<EquipmentSlot | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch(endpoint).then((r) => r.json().then((d) => ({ ok: r.ok, d }))), loadOsrsData()])
      .then(([{ ok, d }, osrs]) => {
        if (cancelled) return;
        setData(osrs);
        if (!ok) setError(d.error ?? "Couldn't load the character.");
        else if (mode === "member") {
          setOwn({ look: d.character?.look ?? null, gear: d.character?.gear ?? {} });
          if (d.defaultCharacter) setFallback(d.defaultCharacter);
        } else {
          setOwn({ look: d.character?.look ?? defaultLook(), gear: d.character?.gear ?? {} });
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't load the character.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, mode]);

  const look = own.look ?? fallback.look;
  const preview: Character = mode === "member" ? { look, gear: { ...fallback.gear, ...own.gear } } : { look, gear: own.gear };

  const setLook = (next: CharacterLook) => {
    setOwn((o) => ({ ...o, look: next }));
    setStatus(null);
  };
  const setGear = (s: EquipmentSlot, item: { id: number; name: string } | null) => {
    setOwn((o) => {
      const gear = { ...o.gear };
      if (item) gear[s] = item;
      else delete gear[s];
      return { ...o, gear };
    });
    setStatus(null);
  };

  const save = async (next: Own = own) => {
    setSaving(true);
    setError(null);
    const res = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ character: next }) });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) setStatus(mode === "member" ? "Saved. Your profile shows this character now." : "Saved as the clan default.");
    else setError(body.error ?? "Failed to save.");
  };

  if (loading) return <p className="text-sm text-iron-grey">Loading character...</p>;

  const tabClass = (t: string) =>
    `px-3 py-1.5 text-sm font-semibold rounded-md cursor-pointer ${tab === t ? "bg-gnome-green text-white" : "text-bark-brown hover:bg-parchment-dark"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-5">
        <div className="shrink-0 w-full md:w-[300px] h-[380px] sm:h-[420px] rounded-lg overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 35%, #5a4a34 0%, #2e2519 70%, #1d1710 100%)" }}>
          <CharacterViewer character={preview} className="w-full h-full" />
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-1" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "look"} onClick={() => setTab("look")} className={tabClass("look")}>
              Look
            </button>
            <button type="button" role="tab" aria-selected={tab === "gear"} onClick={() => setTab("gear")} className={tabClass("gear")}>
              Gear
            </button>
          </div>

          {tab === "look" && data && (
            <div className="space-y-4">
              {mode === "member" && !own.look && <p className="text-xs text-iron-grey">Using the clan default look. Change anything to make it yours.</p>}
              <div className="flex gap-2">
                {[false, true].map((female) => (
                  <button
                    key={String(female)}
                    type="button"
                    onClick={() => look.female !== female && setLook({ ...defaultLook(female), colours: look.colours })}
                    className={`px-3 py-1.5 rounded-md border text-sm cursor-pointer ${look.female === female ? "border-gnome-green bg-gnome-green/10 text-gnome-green font-semibold" : "border-bark-brown-light/50 text-bark-brown hover:bg-parchment-dark"}`}
                  >
                    {female ? "Body type B" : "Body type A"}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {BODY_PARTS.map((_, part) => {
                  const options = kitOptions(data.kitList, part, look.female).map((k) => k.id);
                  if (part === 1) options.unshift(-1);
                  if (options.length === 0) return null;
                  return (
                    <Stepper
                      key={part}
                      label={PART_LABELS[part]}
                      value={look.kits[part]}
                      options={options}
                      onChange={(v) => setLook({ ...look, kits: look.kits.map((k, i) => (i === part ? v : k)) })}
                    />
                  );
                })}
              </div>
              <div className="space-y-2">
                {COLOUR_LABELS.map((label, slotIndex) => (
                  <div key={label}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-iron-grey mb-1">{label} colour</p>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: COLOUR_COUNTS[slotIndex] }, (_, choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => setLook({ ...look, colours: look.colours.map((c, i) => (i === slotIndex ? choice : c)) })}
                          aria-label={`${label} colour ${choice + 1}`}
                          aria-pressed={look.colours[slotIndex] === choice}
                          className={`w-6 h-6 rounded cursor-pointer border ${look.colours[slotIndex] === choice ? "ring-2 ring-gnome-green ring-offset-1 border-transparent" : "border-black/20"}`}
                          style={{ background: hslToCss(colourSwatch(slotIndex, choice)) }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "gear" && data && (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="shrink-0">
                <EquipmentPanel gear={preview.gear} onSlotClick={(s) => setSlot((cur) => (cur === s ? null : s))} activeSlot={slot} />
                <p className="mt-2 text-xs text-iron-grey max-w-[13rem]">Click a slot to choose its item.</p>
              </div>
              <div className="flex-1 min-w-0">
                {slot ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-bark-brown">{SLOT_LABELS[slot]}</p>
                      <button type="button" onClick={() => setSlot(null)} className="text-xs text-iron-grey hover:underline cursor-pointer">
                        Done
                      </button>
                    </div>
                    <p className="text-sm text-bark-brown-light">
                      {own.gear[slot] ? (
                        <>
                          Wearing: <strong>{own.gear[slot]!.name}</strong>
                        </>
                      ) : mode === "member" && fallback.gear[slot] ? (
                        <>
                          Using the clan default: <strong>{fallback.gear[slot]!.name}</strong>
                        </>
                      ) : (
                        "Empty"
                      )}
                    </p>
                    <ItemPicker key={slot} data={data} slot={slot} current={own.gear[slot]?.id ?? null} onPick={(id, name) => setGear(slot, { id, name })} />
                    {own.gear[slot] && (
                      <button type="button" onClick={() => setGear(slot, null)} className="text-xs text-red-accent hover:underline cursor-pointer">
                        {mode === "member" ? "Clear (use the clan default)" : "Clear slot"}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-bark-brown-light">
                    {mode === "member"
                      ? "Pick your fashionscape. Any slot you leave empty shows the clan's gnome outfit."
                      : "These items are worn by every member who hasn't picked their own. Set them to the clan's gnome fashionscape."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-accent">{error}</p>}
      {status && <p className="text-sm text-gnome-green">{status}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={saving} onClick={() => save()}>
          {saving ? "Saving..." : "Save character"}
        </Button>
        {mode === "member" && (own.look || Object.keys(own.gear).length > 0) && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              const reset = { look: null, gear: {} };
              setOwn(reset);
              void save(reset);
            }}
            className="text-sm text-iron-grey hover:underline cursor-pointer"
          >
            Reset to the clan default
          </button>
        )}
        <span className="text-xs text-iron-grey">Drag the character to turn it.</span>
      </div>
    </div>
  );
}
