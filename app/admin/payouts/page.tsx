"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Payout {
  id: string;
  recipient_rsn: string;
  prize: string;
  category: string;
  source_detail: string | null;
  is_paid: boolean;
  paid_at: string | null;
  paid_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: "sotw", label: "Skill of the Week" },
  { key: "botw", label: "Boss of the Week" },
  { key: "event", label: "Event" },
  { key: "raffle", label: "Raffle" },
  { key: "giveaway", label: "Giveaway" },
  { key: "other", label: "Other" },
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

type FilterTab = "unpaid" | "paid" | "all";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("unpaid");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [batchCategory, setBatchCategory] = useState("sotw");
  const [batchSourceDetail, setBatchSourceDetail] = useState("");
  const [rows, setRows] = useState<{ recipient_rsn: string; prize: string }[]>([{ recipient_rsn: "", prize: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/payouts");
    const data = await res.json().catch(() => ({}));
    setPayouts(res.ok ? data.payouts ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRow = (i: number, field: "recipient_rsn" | "prize", value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { recipient_rsn: "", prize: "" }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    const entries = rows
      .filter((r) => r.recipient_rsn.trim() && r.prize.trim())
      .map((r) => ({ ...r, category: batchCategory, source_detail: batchSourceDetail || undefined }));

    const res = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setStatus(`Added ${data.payouts?.length ?? entries.length} payout${(data.payouts?.length ?? entries.length) === 1 ? "" : "s"}.`);
      setRows([{ recipient_rsn: "", prize: "" }]);
      setBatchSourceDetail("");
      await load();
    } else {
      setStatus(data.error ?? "Failed to save payouts.");
    }
    setSubmitting(false);
  };

  const togglePaid = async (payout: Payout) => {
    setBusyId(payout.id);
    const res = await fetch(`/api/admin/payouts/${payout.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_paid: !payout.is_paid }),
    });
    if (res.ok) await load();
    setBusyId(null);
  };

  const handleDelete = async (payout: Payout) => {
    if (!confirm(`Delete the payout entry for ${payout.recipient_rsn} (${payout.prize})?`)) return;
    setBusyId(payout.id);
    const res = await fetch(`/api/admin/payouts/${payout.id}`, { method: "DELETE" });
    if (res.ok) await load();
    setBusyId(null);
  };

  const filtered = payouts.filter((p) => {
    if (tab === "unpaid") return !p.is_paid;
    if (tab === "paid") return p.is_paid;
    return true;
  });
  const unpaidCount = payouts.filter((p) => !p.is_paid).length;

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Prize Payouts</h1>
      <p className="text-bark-brown-light mb-6">
        Track whether competition, raffle, and giveaway winners have actually been paid out.
      </p>

      <Card hover={false} className="mb-8">
        <h2 className="font-display text-lg text-bark-brown mb-4">Add Winners</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Category</label>
              <select value={batchCategory} onChange={(e) => setBatchCategory(e.target.value)} className={`${inputClass} cursor-pointer`}>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Source / Occasion (optional)</label>
              <input
                type="text"
                value={batchSourceDetail}
                onChange={(e) => setBatchSourceDetail(e.target.value)}
                placeholder="e.g. Slayer — week of 8/2"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-2">Winners</label>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={row.recipient_rsn}
                    onChange={(e) => updateRow(i, "recipient_rsn", e.target.value)}
                    placeholder="RSN"
                    className={`${inputClass} flex-1 font-mono`}
                  />
                  <input
                    type="text"
                    value={row.prize}
                    onChange={(e) => updateRow(i, "prize", e.target.value)}
                    placeholder="Prize, e.g. 6,500,000 GP"
                    className={`${inputClass} flex-1`}
                  />
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} className="text-red-accent hover:underline text-xs cursor-pointer shrink-0 px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addRow} className="mt-2">+ Add Row</Button>
          </div>

          {status && (
            <div className="p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
              {status}
            </div>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Add Winners"}
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap gap-2 mb-4">
        {([
          { key: "unpaid", label: `Unpaid${unpaidCount > 0 ? ` (${unpaidCount})` : ""}` },
          { key: "paid", label: "Paid" },
          { key: "all", label: "All" },
        ] as { key: FilterTab; label: string }[]).map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "primary" : "ghost"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card hover={false}><p className="text-sm text-iron-grey">Nothing here.</p></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-bark-brown">
                    <span className="font-mono">{p.recipient_rsn}</span>
                    <span className="text-bark-brown-light font-normal"> — {p.prize}</span>
                  </p>
                  <p className="text-xs text-iron-grey mt-0.5">
                    <span className="px-1.5 py-0.5 rounded bg-gnome-green/10 text-gnome-green">{CATEGORY_LABELS[p.category] ?? p.category}</span>
                    {p.source_detail && <span className="ml-2">{p.source_detail}</span>}
                  </p>
                  <p className="text-xs text-iron-grey mt-1">
                    {p.is_paid
                      ? `Paid${p.paid_by ? ` by ${p.paid_by}` : ""}${p.paid_at ? ` on ${new Date(p.paid_at).toLocaleDateString()}` : ""}`
                      : `Added ${new Date(p.created_at).toLocaleDateString()}${p.created_by ? ` by ${p.created_by}` : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant={p.is_paid ? "ghost" : "primary"} disabled={busyId === p.id} onClick={() => togglePaid(p)}>
                    {busyId === p.id ? "..." : p.is_paid ? "Mark Unpaid" : "Mark Paid"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    disabled={busyId === p.id}
                    className="text-xs text-red-accent hover:underline cursor-pointer shrink-0"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
