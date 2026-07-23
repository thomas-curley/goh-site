"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function LootSplitPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customValue, setCustomValue] = useState("");

  const [loot, setLoot] = useState<LootRow[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [taxPct, setTaxPct] = useState(0);
  const [mode, setMode] = useState<"even" | "weighted">("even");
  const [weights, setWeights] = useState<Record<string, number>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const removeItem = (key: string) => {
    setLoot((prev) => prev.filter((r) => r.key !== key));
  };

  const addParticipant = () => {
    const name = participantInput.trim();
    if (!name || participants.includes(name)) return;
    setParticipants((prev) => [...prev, name]);
    setWeights((prev) => ({ ...prev, [name]: prev[name] ?? 1 }));
    setParticipantInput("");
  };

  const removeParticipant = (name: string) => {
    setParticipants((prev) => prev.filter((p) => p !== name));
  };

  const totalValue = useMemo(() => loot.reduce((sum, r) => sum + r.unitPrice * r.qty, 0), [loot]);
  const afterTax = useMemo(() => Math.max(0, totalValue * (1 - taxPct / 100)), [totalValue, taxPct]);

  const splits = useMemo(() => {
    if (participants.length === 0) return [];
    if (mode === "even") {
      const share = afterTax / participants.length;
      return participants.map((p) => ({ name: p, weight: 1, share }));
    }
    const totalWeight = participants.reduce((sum, p) => sum + (weights[p] ?? 1), 0) || 1;
    return participants.map((p) => {
      const w = weights[p] ?? 1;
      return { name: p, weight: w, share: afterTax * (w / totalWeight) };
    });
  }, [participants, mode, weights, afterTax]);

  const floored = splits.map((s) => ({ ...s, amount: Math.floor(s.share) }));
  const remainder = afterTax - floored.reduce((sum, s) => sum + s.amount, 0);

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
            {loot.map((row) => (
              <div key={row.key} className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-bark-brown truncate">{row.name}</span>
                <input
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={(e) => updateQty(row.key, Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm"
                />
                <span className="w-24 text-right font-stats text-gnome-green">{formatNumber(row.unitPrice * row.qty)}</span>
                <button onClick={() => removeItem(row.key)} className="text-red-accent text-xs cursor-pointer">Remove</button>
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-bark-brown font-semibold mt-4 pt-3 border-t border-parchment-dark">
          Total: {formatNumber(totalValue)} gp ({totalValue.toLocaleString()})
        </p>
      </Card>

      <Card hover={false} className="mb-6">
        <h3 className="font-display text-lg text-bark-brown mb-3">Participants</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={participantInput}
            onChange={(e) => setParticipantInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(); } }}
            placeholder="RSN or name"
            className={inputClass}
          />
          <Button type="button" size="sm" onClick={addParticipant}>Add</Button>
        </div>
        {participants.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gnome-green/10 text-gnome-green text-sm">
                {p}
                <button onClick={() => removeParticipant(p)} className="cursor-pointer">×</button>
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card hover={false} className="mb-6">
        <h3 className="font-display text-lg text-bark-brown mb-3">Split Settings</h3>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-xs text-iron-grey mb-1">Clan tax %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={taxPct}
              onChange={(e) => setTaxPct(Math.min(100, Math.max(0, Number(e.target.value))))}
              className={`${inputClass} w-24`}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" variant={mode === "even" ? "primary" : "ghost"} onClick={() => setMode("even")}>
              Even Split
            </Button>
            <Button type="button" size="sm" variant={mode === "weighted" ? "primary" : "ghost"} onClick={() => setMode("weighted")}>
              Weighted Split
            </Button>
          </div>
        </div>

        {mode === "weighted" && participants.length > 0 && (
          <div className="mt-4 space-y-2">
            {participants.map((p) => (
              <div key={p} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-bark-brown">{p}</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={weights[p] ?? 1}
                  onChange={(e) => setWeights((prev) => ({ ...prev, [p]: Number(e.target.value) }))}
                  className="w-20 px-2 py-1 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card hover={false}>
        <h3 className="font-display text-lg text-bark-brown mb-3">Results</h3>
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
                {floored.map((s) => (
                  <tr key={s.name} className="border-b border-parchment-dark last:border-0">
                    <td className="py-2 text-bark-brown">{s.name}</td>
                    {mode === "weighted" && <td className="py-2 text-right text-iron-grey">{s.weight}</td>}
                    <td className="py-2 text-right font-stats text-gnome-green">{s.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {taxPct > 0 && (
              <p className="text-xs text-iron-grey mt-3">
                {taxPct}% clan tax deducted: {(totalValue - afterTax).toLocaleString()} gp
              </p>
            )}
            {remainder > 0 && (
              <p className="text-xs text-iron-grey mt-1">
                {Math.round(remainder).toLocaleString()} gp leftover due to rounding — hand it to whoever cleaned up.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
