"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RsnAutocomplete } from "@/components/admin/RsnAutocomplete";
import { AttendanceExport } from "@/components/admin/AttendanceExport";

function normalizeRsn(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

interface Raffle {
  id: string;
  title: string;
  occurred_on: string;
  created_by: string | null;
  created_at: string;
}

/** The slice of a prize_payouts row this page shows under each raffle. */
interface RaffleWinner {
  id: string;
  recipient_rsn: string;
  prize: string;
  is_paid: boolean;
  raffle_id: string | null;
}

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function RafflesPage() {
  const [payouts, setPayouts] = useState<RaffleWinner[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [linkedRsns, setLinkedRsns] = useState<Set<string>>(new Set());
  const [notifyWinners, setNotifyWinners] = useState(false);

  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [defaultPrizeAmount, setDefaultPrizeAmount] = useState<number | null>(null);
  const [raffleTitle, setRaffleTitle] = useState("");
  const [raffleDate, setRaffleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [creatingRaffle, setCreatingRaffle] = useState(false);
  const [expandedRaffleId, setExpandedRaffleId] = useState<string | null>(null);
  // Whether a raffle's winners list is shown, keyed by raffle id -- only the
  // most recent raffle starts expanded so a growing history doesn't turn
  // this into an endless scroll; anything toggled manually is remembered.
  const [raffleWinnersExpanded, setRaffleWinnersExpanded] = useState<Record<string, boolean>>({});
  const [raffleRows, setRaffleRows] = useState<{ recipient_rsn: string; prize: string }[]>([{ recipient_rsn: "", prize: "" }]);
  const [raffleSubmitting, setRaffleSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/payouts");
    const data = await res.json().catch(() => ({}));
    setPayouts(res.ok ? data.payouts ?? [] : []);
  }, []);

  const loadRaffles = useCallback(async () => {
    const res = await fetch("/api/admin/raffles");
    const data = await res.json().catch(() => ({}));
    setRaffles(res.ok ? data.raffles ?? [] : []);
    if (res.ok) setDefaultPrizeAmount(data.defaultPrizeAmount ?? null);
  }, []);

  useEffect(() => {
    // Kicked off from a promise callback so no state is set synchronously in the effect.
    void Promise.resolve().then(async () => {
      load();
      loadRaffles();
      const [membersRes, linkedRes] = await Promise.all([fetch("/api/clan-members"), fetch("/api/admin/payouts/linked-rsns")]);
      const membersData = await membersRes.json().catch(() => ({}));
      const linkedData = await linkedRes.json().catch(() => ({}));
      if (membersRes.ok) setRoster((membersData.members ?? []).map((m: { displayName: string }) => m.displayName));
      if (linkedRes.ok) setLinkedRsns(new Set((linkedData.rsns ?? []).map((r: string) => normalizeRsn(r))));
    });
  }, [load, loadRaffles]);

  const handleCreateRaffle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleTitle.trim()) return;
    setCreatingRaffle(true);
    const res = await fetch("/api/admin/raffles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: raffleTitle, occurredOn: raffleDate }),
    });
    if (res.ok) {
      setRaffleTitle("");
      await loadRaffles();
    }
    setCreatingRaffle(false);
  };

  const handleDeleteRaffle = async (raffle: Raffle) => {
    if (!confirm(`Delete raffle "${raffle.title}"? Its winner entries stay in Prize Payouts, just unlinked.`)) return;
    await fetch(`/api/admin/raffles/${raffle.id}`, { method: "DELETE" });
    await loadRaffles();
    await load();
  };

  const updateRaffleRow = (i: number, field: "recipient_rsn" | "prize", value: string) => {
    setRaffleRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };
  const addRaffleRow = () => setRaffleRows((prev) => [...prev, { recipient_rsn: "", prize: "" }]);
  const removeRaffleRow = (i: number) => setRaffleRows((prev) => prev.filter((_, idx) => idx !== i));

  const handleAddRaffleWinners = async (e: React.FormEvent, raffleId: string) => {
    e.preventDefault();
    setRaffleSubmitting(true);
    const entries = raffleRows.filter((r) => r.recipient_rsn.trim() && r.prize.trim()).map((r) => ({ ...r, category: "raffle" }));
    const res = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries, raffleId, notifyWinners }),
    });
    if (res.ok) {
      setRaffleRows([{ recipient_rsn: "", prize: "" }]);
      setExpandedRaffleId(null);
      await load();
    }
    setRaffleSubmitting(false);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Raffles</h1>
      <p className="text-bark-brown-light mb-6">
        Pick the week, draw the winners from event attendance, and save it as the week&apos;s raffle. Winners go to{" "}
        <Link href="/admin/payouts" className="text-gnome-green hover:underline">Prize Payouts</Link> to track payment, and{" "}
        <Link href="/admin/weekly-competition" className="text-gnome-green hover:underline">Weekly SOTW/BotW</Link> fills its raffle
        post from the latest raffle.
      </p>

      <section className="mb-8">
        <AttendanceExport
          defaultPrizeAmount={defaultPrizeAmount}
          onRaffleSaved={() => {
            loadRaffles();
            load();
          }}
        />
      </section>

      <Card hover={false} className="mb-8">
        <h2 className="font-display text-xl text-bark-brown mb-1">Weekly Raffles</h2>
        <p className="text-xs text-iron-grey mb-4">Raffles saved from the draw above, newest first. You can also start one by hand and add its winners yourself.</p>
        <form onSubmit={handleCreateRaffle} className="flex flex-col sm:flex-row gap-2 mb-6">
          <input
            type="text"
            value={raffleTitle}
            onChange={(e) => setRaffleTitle(e.target.value)}
            placeholder="e.g. Week of 8/17 Raffle"
            className={`${inputClass} flex-1`}
          />
          <input type="date" value={raffleDate} onChange={(e) => setRaffleDate(e.target.value)} className={`${inputClass} sm:w-44`} />
          <Button type="submit" size="sm" disabled={creatingRaffle}>
            {creatingRaffle ? "Creating..." : "+ New Raffle"}
          </Button>
        </form>

        {raffles.length === 0 ? (
          <p className="text-sm text-iron-grey">No raffles yet.</p>
        ) : (
          <div className="space-y-4">
            {raffles.map((raffle, i) => {
              const winners = payouts.filter((p) => p.raffle_id === raffle.id);
              const paidCount = winners.filter((w) => w.is_paid).length;
              // Only the most recent raffle (i === 0) starts expanded, unless the admin has toggled this one manually.
              const isExpanded = raffleWinnersExpanded[raffle.id] ?? i === 0;
              return (
                <div key={raffle.id} className="border border-bark-brown-light/40 rounded-md p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <button
                      type="button"
                      onClick={() => setRaffleWinnersExpanded((prev) => ({ ...prev, [raffle.id]: !isExpanded }))}
                      className="flex items-center gap-2 text-left cursor-pointer min-w-0"
                    >
                      <span className={`text-iron-grey text-[10px] shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                      <span className="min-w-0">
                        <p className="font-semibold text-bark-brown text-sm truncate">{raffle.title}</p>
                        <p className="text-xs text-iron-grey">
                          {new Date(raffle.occurred_on).toLocaleDateString()}
                          {winners.length > 0 && ` · ${winners.length} winner${winners.length === 1 ? "" : "s"} (${paidCount} paid)`}
                        </p>
                      </span>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedRaffleId((prev) => (prev === raffle.id ? null : raffle.id))}
                        className="text-xs text-gnome-green hover:underline cursor-pointer"
                      >
                        + Add Winner
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRaffle(raffle)}
                        className="text-xs text-red-accent hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isExpanded && winners.length > 0 && (
                    <ul className="space-y-1 mb-2">
                      {winners.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 text-sm py-1 px-2 rounded bg-parchment-dark/40">
                          <span>
                            <span className="font-mono text-bark-brown">{p.recipient_rsn}</span>
                            <span className="text-bark-brown-light"> — {p.prize || "no amount set"}</span>
                          </span>
                          <span className={`text-xs shrink-0 ${p.is_paid ? "text-gnome-green" : "text-iron-grey"}`}>
                            {p.is_paid ? "Paid" : "Unpaid"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isExpanded && winners.length > 0 && (
                    <p className="text-xs text-iron-grey mb-2">Manage payment status, screenshots, and roll-downs for these on Prize Payouts.</p>
                  )}

                  {expandedRaffleId === raffle.id && (
                    <form onSubmit={(e) => handleAddRaffleWinners(e, raffle.id)} className="space-y-2 mt-2">
                      {raffleRows.map((row, i) => (
                        <div key={i} className="flex gap-2">
                          <RsnAutocomplete
                            value={row.recipient_rsn}
                            onChange={(value) => updateRaffleRow(i, "recipient_rsn", value)}
                            roster={roster}
                            linkedRsns={linkedRsns}
                            className={`${inputClass} font-mono`}
                          />
                          <input
                            type="text"
                            value={row.prize}
                            onChange={(e) => updateRaffleRow(i, "prize", e.target.value)}
                            placeholder="Prize, e.g. 1,000,000 GP"
                            className={`${inputClass} flex-1`}
                          />
                          {raffleRows.length > 1 && (
                            <button type="button" onClick={() => removeRaffleRow(i)} className="text-red-accent hover:underline text-xs cursor-pointer shrink-0 px-2">✕</button>
                          )}
                        </div>
                      ))}
                      <label className="flex items-center gap-2 text-xs text-bark-brown cursor-pointer">
                        <input type="checkbox" checked={notifyWinners} onChange={(e) => setNotifyWinners(e.target.checked)} className="accent-gnome-green" />
                        Also notify winners via Discord DM
                      </label>
                      <div className="flex items-center gap-3">
                        <Button type="button" variant="ghost" size="sm" onClick={addRaffleRow}>+ Add Row</Button>
                        <Button type="submit" size="sm" disabled={raffleSubmitting}>
                          {raffleSubmitting ? "Saving..." : "Save Winners"}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
