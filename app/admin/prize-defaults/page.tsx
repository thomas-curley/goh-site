"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";
// See app/admin/payouts/page.tsx -- w-full conflicts with explicit widths.
const inputClassNoWidth = inputClass.replace("w-full ", "");

export default function PrizeDefaultsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [dmTemplate, setDmTemplate] = useState("");
  const [dmTemplateDraft, setDmTemplateDraft] = useState("");
  const [savingDmTemplate, setSavingDmTemplate] = useState(false);

  const [prizePlacements, setPrizePlacements] = useState<{ placement: number; amount: number }[]>([]);
  const [prizeDefaultAmount, setPrizeDefaultAmount] = useState(0);
  const [prizeDraftPlacements, setPrizeDraftPlacements] = useState<{ placement: number; amount: number }[]>([]);
  const [prizeDraftDefaultAmount, setPrizeDraftDefaultAmount] = useState(0);
  const [savingPrizeDefaults, setSavingPrizeDefaults] = useState(false);

  const loadDmTemplate = useCallback(async () => {
    const res = await fetch("/api/admin/payouts/dm-config");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDmTemplate(data.template ?? "");
      setDmTemplateDraft(data.template ?? "");
    }
  }, []);

  const loadPrizeDefaults = useCallback(async () => {
    const res = await fetch("/api/admin/payouts/prize-defaults");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPrizePlacements(data.placements ?? []);
      setPrizeDraftPlacements(data.placements ?? []);
      setPrizeDefaultAmount(data.defaultAmount ?? 0);
      setPrizeDraftDefaultAmount(data.defaultAmount ?? 0);
    }
  }, []);

  useEffect(() => {
    // Kicked off from a promise callback so no state is set synchronously in the effect.
    void Promise.resolve().then(() => Promise.all([loadDmTemplate(), loadPrizeDefaults()]));
  }, [loadDmTemplate, loadPrizeDefaults]);

  const addPrizePlacementRow = () =>
    setPrizeDraftPlacements((prev) => [...prev, { placement: prev.length > 0 ? Math.max(...prev.map((p) => p.placement)) + 1 : 1, amount: 0 }]);
  const updatePrizePlacementRow = (i: number, patch: Partial<{ placement: number; amount: number }>) =>
    setPrizeDraftPlacements((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePrizePlacementRow = (i: number) => setPrizeDraftPlacements((prev) => prev.filter((_, idx) => idx !== i));

  const savePrizeDefaults = async () => {
    setSavingPrizeDefaults(true);
    const res = await fetch("/api/admin/payouts/prize-defaults", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placements: prizeDraftPlacements, defaultAmount: prizeDraftDefaultAmount }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("Prize defaults saved.");
      await loadPrizeDefaults();
    } else {
      setStatus(data.error ?? "Failed to save prize defaults.");
    }
    setSavingPrizeDefaults(false);
  };

  const saveDmTemplate = async () => {
    setSavingDmTemplate(true);
    const res = await fetch("/api/admin/payouts/dm-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: dmTemplateDraft }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDmTemplate(dmTemplateDraft);
      setStatus("DM template saved.");
    } else {
      setStatus(data.error ?? "Failed to save template.");
    }
    setSavingDmTemplate(false);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Prize &amp; DM Defaults</h1>
      <p className="text-bark-brown-light mb-6">Default prize amounts per placement, and the DM sent to winners from Prize Payouts.</p>

      {status && <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>}

      <Card hover={false} className="mb-8">
        <h2 className="font-display text-lg text-bark-brown">Default Prize Structure</h2>
        <p className="text-xs text-iron-grey mt-1">
          Used to pre-fill prize amounts when winners are pulled in from a competition on Prize Payouts, and for the
          prize table in the weekly SOTW/BotW forum post.
        </p>

        {(
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              {prizeDraftPlacements.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-iron-grey w-14 shrink-0">Place</span>
                  <input
                    type="number"
                    min={1}
                    value={p.placement}
                    onChange={(e) => updatePrizePlacementRow(i, { placement: Math.max(1, Number(e.target.value) || 1) })}
                    className={`${inputClassNoWidth} w-20 shrink-0`}
                  />
                  <span className="text-xs text-iron-grey w-14 shrink-0">Amount</span>
                  <input
                    type="number"
                    min={0}
                    value={p.amount}
                    onChange={(e) => updatePrizePlacementRow(i, { amount: Math.max(0, Number(e.target.value) || 0) })}
                    className={`${inputClassNoWidth} flex-1 min-w-0`}
                  />
                  <button type="button" onClick={() => removePrizePlacementRow(i)} className="text-red-accent hover:underline text-xs cursor-pointer shrink-0 px-2">✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addPrizePlacementRow} className="text-xs text-gnome-green hover:underline cursor-pointer">+ Add placement</button>

            <div className="flex items-center gap-2 pt-2">
              <label className="text-sm text-bark-brown shrink-0">Every other placement:</label>
              <input
                type="number"
                min={0}
                value={prizeDraftDefaultAmount}
                onChange={(e) => setPrizeDraftDefaultAmount(Math.max(0, Number(e.target.value) || 0))}
                className={`${inputClass} sm:w-48`}
              />
              <span className="text-xs text-iron-grey shrink-0">GP each</span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button size="sm" disabled={savingPrizeDefaults} onClick={savePrizeDefaults}>
                {savingPrizeDefaults ? "Saving..." : "Save Defaults"}
              </Button>
              {(JSON.stringify(prizeDraftPlacements) !== JSON.stringify(prizePlacements) || prizeDraftDefaultAmount !== prizeDefaultAmount) && (
                <button
                  type="button"
                  onClick={() => { setPrizeDraftPlacements(prizePlacements); setPrizeDraftDefaultAmount(prizeDefaultAmount); }}
                  className="text-xs text-iron-grey hover:underline cursor-pointer"
                >
                  Revert changes
                </button>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card hover={false} className="mb-8">
        <h2 className="font-display text-lg text-bark-brown">Winner DM Message</h2>
        <p className="text-xs text-iron-grey mt-1">
          When notifying a winner, this message is sent as a Discord DM -- only works if their RSN is linked to a
          verified account.
        </p>

        {(
          <div className="mt-4 space-y-3">
            <textarea
              value={dmTemplateDraft}
              onChange={(e) => setDmTemplateDraft(e.target.value)}
              rows={4}
              maxLength={1000}
              className={inputClass}
            />
            <p className="text-xs text-iron-grey">
              Variables: <span className="font-mono">{"{user}"}</span> <span className="font-mono">{"{payout}"}</span>{" "}
              <span className="font-mono">{"{competition}"}</span> <span className="font-mono">{"{placement}"}</span> (placement is
              only set for competition winners, e.g. &quot;1st&quot; -- blank for raffles/manual entries).
            </p>
            <div className="flex items-center gap-3">
              <Button size="sm" disabled={savingDmTemplate || !dmTemplateDraft.trim()} onClick={saveDmTemplate}>
                {savingDmTemplate ? "Saving..." : "Save Template"}
              </Button>
              {dmTemplateDraft !== dmTemplate && (
                <button type="button" onClick={() => setDmTemplateDraft(dmTemplate)} className="text-xs text-iron-grey hover:underline cursor-pointer">
                  Revert changes
                </button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
