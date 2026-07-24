"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { formatNumber } from "@/lib/utils";

interface SearchResult {
  id: number;
  name: string;
  price: number | null;
}

interface LootRow {
  key: string;
  name: string;
  unitPrice: number;
  qty: number;
}

interface Participant {
  id: string;
  name: string;
}

interface PastEvent {
  id: string;
  title: string;
  start_time: string;
}

const MAX_PARTICIPANTS = 50;

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function LootSplitPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customValue, setCustomValue] = useState("");

  const [loot, setLoot] = useState<LootRow[]>([]);

  const [events, setEvents] = useState<PastEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeError, setAttendeeError] = useState<string | null>(null);

  const [loggedIn, setLoggedIn] = useState(false);
  const [savedLootCount, setSavedLootCount] = useState(0);
  const [loadingLoot, setLoadingLoot] = useState(false);
  const [savingLoot, setSavingLoot] = useState(false);
  const [lootStatus, setLootStatus] = useState<string | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [mode, setMode] = useState<"even" | "weighted">("even");
  const [weights, setWeights] = useState<Record<string, number>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadEvents() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("events")
        .select("id, title, start_time")
        .lte("start_time", new Date().toISOString())
        .order("start_time", { ascending: false })
        .limit(20);
      if (data) setEvents(data);
    }
    loadEvents().catch(() => {});

    async function checkAuth() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        setLoggedIn(!!user);
      } catch {
        // Supabase not configured
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setSavedLootCount(0);
      return;
    }
    let cancelled = false;
    fetch(`/api/events/${selectedEventId}/loot`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSavedLootCount(Array.isArray(data.items) ? data.items.length : 0);
      })
      .catch(() => {
        if (!cancelled) setSavedLootCount(0);
      });
    return () => { cancelled = true; };
  }, [selectedEventId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/items/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSearchResults(res.ok ? data.items ?? [] : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const addItem = (item: SearchResult) => {
    setLoot((prev) => [
      ...prev,
      { key: `${item.id}-${Date.now()}`, name: item.name, unitPrice: item.price ?? 0, qty: 1 },
    ]);
    setQuery("");
    setSearchResults([]);
  };

  const addCustom = () => {
    const value = Number(customValue);
    if (!customName.trim() || !Number.isFinite(value) || value <= 0) return;
    setLoot((prev) => [
      ...prev,
      { key: `custom-${Date.now()}`, name: customName.trim(), unitPrice: value, qty: 1 },
    ]);
    setCustomName("");
    setCustomValue("");
    setShowCustom(false);
  };

  const updateQty = (key: string, qty: number) => {
    setLoot((prev) => prev.map((r) => (r.key === key ? { ...r, qty: Math.max(1, qty) } : r)));
  };

  const updatePrice = (key: string, unitPrice: number) => {
    setLoot((prev) => prev.map((r) => (r.key === key ? { ...r, unitPrice: Math.max(0, unitPrice) } : r)));
  };

  const removeItem = (key: string) => {
    setLoot((prev) => prev.filter((r) => r.key !== key));
  };

  const resizeParticipants = (count: number) => {
    const n = Math.max(0, Math.min(MAX_PARTICIPANTS, Math.floor(count) || 0));
    setParticipants((prev) => {
      if (n <= prev.length) return prev.slice(0, n);
      const additions: Participant[] = Array.from({ length: n - prev.length }, (_, i) => ({
        id: `p-${Date.now()}-${prev.length + i}`,
        name: `Participant ${prev.length + i + 1}`,
      }));
      return [...prev, ...additions];
    });
  };

  const addParticipant = () => resizeParticipants(participants.length + 1);

  const removeParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const renameParticipant = (id: string, name: string) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const loadAttendees = useCallback(async () => {
    if (!selectedEventId) return;
    setLoadingAttendees(true);
    setAttendeeError(null);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/attendance`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load attendees.");

      interface AttendanceRow {
        discord_id: string;
        discord_username: string | null;
        discord_nickname: string | null;
        rsn: string | null;
        attended: boolean;
      }
      const rows: AttendanceRow[] = (data.attendance ?? []).filter((r: AttendanceRow) => r.attended);

      if (rows.length === 0) {
        setAttendeeError("No one is marked as attended for this event yet.");
        return;
      }

      setParticipants(
        rows.map((r, i) => ({
          id: r.discord_id || `att-${i}`,
          name: r.rsn || r.discord_nickname || r.discord_username || `Participant ${i + 1}`,
        }))
      );
      setWeights({});
    } catch (err) {
      setAttendeeError(err instanceof Error ? err.message : "Failed to load attendees.");
    } finally {
      setLoadingAttendees(false);
    }
  }, [selectedEventId]);

  const loadSavedLoot = useCallback(async () => {
    if (!selectedEventId) return;
    setLoadingLoot(true);
    setLootStatus(null);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/loot`);
      const data = await res.json();
      const items: { name: string; unitPrice: number; qty: number }[] = data.items ?? [];
      setLoot(
        items.map((item, i) => ({
          key: `saved-${i}-${Date.now()}`,
          name: item.name,
          unitPrice: item.unitPrice,
          qty: item.qty,
        }))
      );
    } catch {
      setLootStatus("Failed to load saved loot.");
    } finally {
      setLoadingLoot(false);
    }
  }, [selectedEventId]);

  const saveLoot = useCallback(async () => {
    if (!selectedEventId || loot.length === 0) return;
    setSavingLoot(true);
    setLootStatus(null);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/loot`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: loot.map((r) => ({ name: r.name, unitPrice: r.unitPrice, qty: r.qty })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLootStatus("Loot saved to event.");
        setSavedLootCount(loot.length);
      } else {
        setLootStatus(data.error ?? "Failed to save loot.");
      }
    } catch {
      setLootStatus("Failed to save loot.");
    } finally {
      setSavingLoot(false);
    }
  }, [selectedEventId, loot]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const totalValue = useMemo(() => loot.reduce((sum, r) => sum + r.unitPrice * r.qty, 0), [loot]);

  const splits = useMemo(() => {
    if (participants.length === 0) return [];
    if (mode === "even") {
      const share = totalValue / participants.length;
      return participants.map((p) => ({ name: p.name, weight: 1, share }));
    }
    const totalWeight = participants.reduce((sum, p) => sum + (weights[p.id] ?? 1), 0) || 1;
    return participants.map((p) => {
      const w = weights[p.id] ?? 1;
      return { name: p.name, weight: w, share: totalValue * (w / totalWeight) };
    });
  }, [participants, mode, weights, totalValue]);

  const floored = splits.map((s) => ({ ...s, amount: Math.floor(s.share) }));
  const remainder = totalValue - floored.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl text-gnome-green mb-1">Loot Split Calculator</h1>
      <p className="text-bark-brown-light mb-6">
        Search items for live Grand Exchange prices, add participants, and split the loot.
      </p>

      <Card hover={false} className="mb-6">
        <h3 className="font-display text-lg text-bark-brown mb-3">Loot</h3>

        <div className="relative mb-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for an item..."
            className={inputClass}
          />
          {query.trim().length >= 2 && (
            <div className="absolute z-10 mt-1 w-full bg-parchment border border-bark-brown-light rounded-md shadow-lg max-h-64 overflow-y-auto">
              {searching ? (
                <p className="px-3 py-2 text-sm text-iron-grey">Searching...</p>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-iron-grey">No items found.</p>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-parchment-dark transition-colors cursor-pointer"
                  >
                    <span className="text-bark-brown">{item.name}</span>
                    <span className="text-gnome-green font-stats">
                      {item.price != null ? `${formatNumber(item.price)} gp` : "no price data"}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {showCustom ? (
          <div className="flex flex-wrap gap-2 items-end mb-2">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-iron-grey mb-1">Name</label>
              <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} className={inputClass} />
            </div>
            <div className="w-32">
              <label className="block text-xs text-iron-grey mb-1">Total value (gp)</label>
              <input type="number" min={1} value={customValue} onChange={(e) => setCustomValue(e.target.value)} className={inputClass} />
            </div>
            <Button type="button" size="sm" onClick={addCustom}>Add</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCustom(false)}>Cancel</Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="text-xs text-gnome-green hover:underline mb-3 cursor-pointer"
          >
            + Add custom value (for untradeables)
          </button>
        )}

        {loot.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3 text-xs text-iron-grey uppercase tracking-wide">
              <span className="flex-1">Item</span>
              <span className="w-28 text-right">Unit Price</span>
              <span className="w-16 text-right">Qty</span>
              <span className="w-24 text-right">Total</span>
              <span className="w-14" />
            </div>
            {loot.map((row) => (
              <div key={row.key} className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-bark-brown truncate">{row.name}</span>
                <input
                  type="number"
                  min={0}
                  value={row.unitPrice}
                  onChange={(e) => updatePrice(row.key, Number(e.target.value))}
                  title="Override the price — useful when the market's bad or you're instant-selling for less"
                  className="w-28 px-2 py-1 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm text-right"
                />
                <input
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={(e) => updateQty(row.key, Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm text-right"
                />
                <span className="w-24 text-right font-stats text-gnome-green">{formatNumber(row.unitPrice * row.qty)}</span>
                <button onClick={() => removeItem(row.key)} className="w-14 text-red-accent text-xs cursor-pointer text-right">Remove</button>
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-bark-brown font-semibold mt-4 pt-3 border-t border-parchment-dark">
          Total: {formatNumber(totalValue)} gp ({totalValue.toLocaleString()})
        </p>
      </Card>

      <Card hover={false} className="mb-6">
        <h3 className="font-display text-lg text-bark-brown mb-3">Event (optional)</h3>
        <p className="text-xs text-iron-grey mb-3">
          Reference the event this loot is from, and optionally load its attendees as participants.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <select
              value={selectedEventId}
              onChange={(e) => { setSelectedEventId(e.target.value); setAttendeeError(null); }}
              className={inputClass}
            >
              <option value="">No event selected</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} — {new Date(ev.start_time).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" size="sm" variant="secondary" disabled={!selectedEventId || loadingAttendees} onClick={loadAttendees}>
            {loadingAttendees ? "Loading..." : "Load Attendees as Participants"}
          </Button>
        </div>
        {attendeeError && <p className="text-xs text-red-accent mt-2">{attendeeError}</p>}

        {selectedEventId && (
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-parchment-dark">
            {savedLootCount > 0 && (
              <Button type="button" size="sm" variant="secondary" disabled={loadingLoot} onClick={loadSavedLoot}>
                {loadingLoot ? "Loading..." : `Load Saved Loot (${savedLootCount})`}
              </Button>
            )}
            {loggedIn ? (
              <Button type="button" size="sm" disabled={loot.length === 0 || savingLoot} onClick={saveLoot}>
                {savingLoot ? "Saving..." : "Save Loot to Event"}
              </Button>
            ) : (
              <a href="/login" className="text-xs text-gnome-green hover:underline">
                Log in to save loot to this event
              </a>
            )}
            {lootStatus && <p className="text-xs text-iron-grey">{lootStatus}</p>}
          </div>
        )}
      </Card>

      <Card hover={false} className="mb-6">
        <h3 className="font-display text-lg text-bark-brown mb-3">Participants</h3>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-bark-brown">Number of participants</label>
          <button
            type="button"
            onClick={() => resizeParticipants(participants.length - 1)}
            className="w-7 h-7 rounded-md border border-bark-brown-light text-bark-brown cursor-pointer"
          >
            −
          </button>
          <input
            type="number"
            min={0}
            max={MAX_PARTICIPANTS}
            value={participants.length}
            onChange={(e) => resizeParticipants(Number(e.target.value))}
            className="w-16 px-2 py-1 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm text-center"
          />
          <button
            type="button"
            onClick={() => resizeParticipants(participants.length + 1)}
            className="w-7 h-7 rounded-md border border-bark-brown-light text-bark-brown cursor-pointer"
          >
            +
          </button>
        </div>

        {participants.length > 0 && (
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => renameParticipant(p.id, e.target.value)}
                  className={inputClass}
                />
                <button onClick={() => removeParticipant(p.id)} className="text-red-accent text-xs cursor-pointer shrink-0">×</button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addParticipant}
          className="text-xs text-gnome-green hover:underline mt-3 cursor-pointer"
        >
          + Add participant
        </button>
      </Card>

      <Card hover={false} className="mb-6">
        <h3 className="font-display text-lg text-bark-brown mb-3">Split Settings</h3>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" variant={mode === "even" ? "primary" : "ghost"} onClick={() => setMode("even")}>
            Even Split
          </Button>
          <Button type="button" size="sm" variant={mode === "weighted" ? "primary" : "ghost"} onClick={() => setMode("weighted")}>
            Weighted Split
          </Button>
        </div>

        {mode === "weighted" && participants.length > 0 && (
          <div className="mt-4 space-y-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-bark-brown">{p.name}</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={weights[p.id] ?? 1}
                  onChange={(e) => setWeights((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                  className="w-20 px-2 py-1 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card hover={false}>
        <h3 className="font-display text-lg text-bark-brown mb-1">Results</h3>
        {selectedEvent && (
          <p className="text-xs text-iron-grey mb-3">
            For: {selectedEvent.title} ({new Date(selectedEvent.start_time).toLocaleDateString()})
          </p>
        )}
        {participants.length === 0 || loot.length === 0 ? (
          <p className="text-sm text-iron-grey">Add loot and at least one participant to see the split.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bark-brown-light text-iron-grey text-xs uppercase tracking-wide">
                  <th className="text-left py-2">Participant</th>
                  {mode === "weighted" && <th className="text-right py-2">Weight</th>}
                  <th className="text-right py-2">Amount (gp)</th>
                </tr>
              </thead>
              <tbody>
                {floored.map((s, i) => (
                  <tr key={`${s.name}-${i}`} className="border-b border-parchment-dark last:border-0">
                    <td className="py-2 text-bark-brown">{s.name}</td>
                    {mode === "weighted" && <td className="py-2 text-right text-iron-grey">{s.weight}</td>}
                    <td className="py-2 text-right font-stats text-gnome-green">{s.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {remainder > 0 && (
              <p className="text-xs text-iron-grey mt-3">
                {Math.round(remainder).toLocaleString()} gp leftover due to rounding — hand it to whoever cleaned up.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
