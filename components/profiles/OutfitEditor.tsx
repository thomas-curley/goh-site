"use client";

import { useEffect, useRef, useState } from "react";
import { EquipmentPanel } from "@/components/profiles/EquipmentPanel";
import { Button } from "@/components/ui/Button";
import { SLOT_LABELS, wikiItemIcon, type EquipmentSlot, type Outfit } from "@/lib/profiles-format";

function SearchResult({ name, onPick }: { name: string; onPick: () => void }) {
  const [hidden, setHidden] = useState(false);
  // The wiki search returns any page; anything without an item icon isn't an item.
  if (hidden) return null;
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-bark-brown hover:bg-parchment-dark cursor-pointer"
      >
        <span className="w-8 h-8 flex items-center justify-center shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wikiItemIcon(name)} alt="" onError={() => setHidden(true)} className="max-w-8 max-h-8 object-contain" />
        </span>
        <span className="min-w-0 truncate">{name}</span>
      </button>
    </li>
  );
}

/**
 * Pick an OSRS item for each equipment slot. `mode="member"` edits the
 * signed-in member's outfit (empty slots show the clan default);
 * `mode="default"` edits the clan's default gnome fashionscape (admin).
 */
export function OutfitEditor({ mode }: { mode: "member" | "default" }) {
  const endpoint = mode === "member" ? "/api/account/outfit" : "/api/admin/profile-default-outfit";
  const [outfit, setOutfit] = useState<Outfit>({});
  const [fallback, setFallback] = useState<Outfit>({});
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState<EquipmentSlot | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (ok) {
          setOutfit(d.outfit ?? {});
          setFallback(d.defaultOutfit ?? {});
        } else {
          setError(d.error ?? "Couldn't load the outfit.");
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't load the outfit.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  // Debounced wiki search for the open slot.
  useEffect(() => {
    const q = query.trim();
    const seq = ++searchSeq.current;
    if (q.length < 2) {
      const t = setTimeout(() => {
        if (seq === searchSeq.current) setResults([]);
      }, 0);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/osrs/item-search?q=${encodeURIComponent(q)}`).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (seq !== searchSeq.current) return;
      setResults((data.items ?? []).map((i: { name: string }) => i.name));
      setError(res?.ok ? null : data.error ?? "Item search is unavailable right now.");
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const openSlot = (s: EquipmentSlot) => {
    setSlot((cur) => (cur === s ? null : s));
    setQuery("");
    setResults([]);
    setStatus(null);
  };

  const setItem = (s: EquipmentSlot, name: string | null) => {
    setOutfit((o) => {
      const next = { ...o };
      if (name) next[s] = { name };
      else delete next[s];
      return next;
    });
    setStatus(null);
  };

  const save = async (next: Outfit = outfit) => {
    setSaving(true);
    setError(null);
    const res = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outfit: next }) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) setStatus(mode === "member" ? "Saved. Your profile shows this outfit now." : "Saved as the clan default.");
    else setError(data.error ?? "Failed to save.");
  };

  if (loading) return <p className="text-sm text-iron-grey">Loading outfit...</p>;

  const preview: Outfit = mode === "member" ? { ...fallback, ...outfit } : outfit;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="shrink-0">
          <EquipmentPanel outfit={preview} onSlotClick={openSlot} activeSlot={slot} />
          <p className="mt-2 text-xs text-iron-grey max-w-[13rem]">Click a slot to choose its item.</p>
        </div>

        <div className="flex-1 min-w-0">
          {slot ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-bark-brown">{SLOT_LABELS[slot]}</p>
                <button type="button" onClick={() => setSlot(null)} className="text-xs text-iron-grey hover:underline cursor-pointer">Done</button>
              </div>
              <p className="text-sm text-bark-brown-light">
                {outfit[slot] ? <>Currently: <strong>{outfit[slot]!.name}</strong></> : mode === "member" && fallback[slot] ? <>Using the clan default: <strong>{fallback[slot]!.name}</strong></> : "Empty"}
              </p>
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search OSRS items for ${SLOT_LABELS[slot].toLowerCase()}...`}
                aria-label="Search items"
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green"
              />
              {searching && <p className="text-xs text-iron-grey">Searching...</p>}
              {results.length > 0 && (
                <ul className="max-h-64 overflow-y-auto rounded-md border border-bark-brown-light/40 p-1">
                  {results.map((name) => (
                    <SearchResult key={name} name={name} onPick={() => { setItem(slot, name); setQuery(""); setResults([]); }} />
                  ))}
                </ul>
              )}
              {outfit[slot] && (
                <button type="button" onClick={() => setItem(slot, null)} className="text-xs text-red-accent hover:underline cursor-pointer">
                  {mode === "member" ? "Clear (use the clan default)" : "Clear slot"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-bark-brown-light">
              {mode === "member"
                ? "Pick your fashionscape for your member profile. Any slot you leave empty shows the clan's gnome outfit."
                : "These items are worn by every member who hasn't picked their own outfit. Set them to the clan's gnome fashionscape."}
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-accent">{error}</p>}
      {status && <p className="text-sm text-gnome-green">{status}</p>}

      <div className="flex flex-wrap gap-3">
        <Button size="sm" disabled={saving} onClick={() => save()}>{saving ? "Saving..." : "Save outfit"}</Button>
        {mode === "member" && Object.keys(outfit).length > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => { setOutfit({}); void save({}); }}
            className="text-sm text-iron-grey hover:underline cursor-pointer"
          >
            Reset to the clan default
          </button>
        )}
      </div>
    </div>
  );
}
