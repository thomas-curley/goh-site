"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/admin/ImageUploader";

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
  wom_competition_id: string | null;
  event_id: string | null;
  raffle_id: string | null;
  screenshot_urls: string[];
  wom_competitions: { title: string } | null;
  events: { title: string } | null;
  raffles: { title: string } | null;
}

interface Raffle {
  id: string;
  title: string;
  occurred_on: string;
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

function linkedSourceLabel(p: Payout): string | null {
  return p.wom_competitions?.title ?? p.events?.title ?? p.raffles?.title ?? null;
}

/** One payout row -- reused for both the main list and each raffle's winner list. */
function PayoutRow({
  payout,
  busyId,
  onTogglePaid,
  onDelete,
  editingPrizeId,
  editPrizeValue,
  onStartEditPrize,
  onEditPrizeChange,
  onSavePrize,
  expandedScreenshotsId,
  onToggleScreenshots,
  onScreenshotsChange,
}: {
  payout: Payout;
  busyId: string | null;
  onTogglePaid: (p: Payout) => void;
  onDelete: (p: Payout) => void;
  editingPrizeId: string | null;
  editPrizeValue: string;
  onStartEditPrize: (p: Payout) => void;
  onEditPrizeChange: (value: string) => void;
  onSavePrize: (p: Payout) => void;
  expandedScreenshotsId: string | null;
  onToggleScreenshots: (id: string) => void;
  onScreenshotsChange: (p: Payout, urls: string[]) => void;
}) {
  const linked = linkedSourceLabel(payout);
  const editingThisPrize = editingPrizeId === payout.id;

  return (
    <Card hover={false}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-bark-brown">
            <span className="font-mono">{payout.recipient_rsn}</span>
            <span className="text-bark-brown-light font-normal"> — </span>
            {editingThisPrize ? (
              <span className="inline-flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={editPrizeValue}
                  onChange={(e) => onEditPrizeChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSavePrize(payout)}
                  placeholder="e.g. 6,500,000 GP"
                  className="px-2 py-0.5 rounded border border-bark-brown-light bg-parchment text-text-primary text-sm w-48"
                />
                <button type="button" onClick={() => onSavePrize(payout)} className="text-xs text-gnome-green hover:underline cursor-pointer">Save</button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onStartEditPrize(payout)}
                className="font-normal text-bark-brown-light hover:text-gnome-green hover:underline cursor-pointer"
                title="Click to edit"
              >
                {payout.prize || "Set amount"}
              </button>
            )}
          </p>
          <p className="text-xs text-iron-grey mt-0.5">
            <span className="px-1.5 py-0.5 rounded bg-gnome-green/10 text-gnome-green">{CATEGORY_LABELS[payout.category] ?? payout.category}</span>
            {linked && <span className="ml-2 px-1.5 py-0.5 rounded bg-gold/10 text-bark-brown">🔗 {linked}</span>}
            {!linked && payout.source_detail && <span className="ml-2">{payout.source_detail}</span>}
          </p>
          <p className="text-xs text-iron-grey mt-1">
            {payout.is_paid
              ? `Paid${payout.paid_by ? ` by ${payout.paid_by}` : ""}${payout.paid_at ? ` on ${new Date(payout.paid_at).toLocaleDateString()}` : ""}`
              : `Added ${new Date(payout.created_at).toLocaleDateString()}${payout.created_by ? ` by ${payout.created_by}` : ""}`}
          </p>

          <button
            type="button"
            onClick={() => onToggleScreenshots(payout.id)}
            className="text-xs text-gnome-green hover:underline cursor-pointer mt-1.5"
          >
            📷 {payout.screenshot_urls.length > 0 ? `${payout.screenshot_urls.length} screenshot${payout.screenshot_urls.length === 1 ? "" : "s"}` : "Add screenshot"}
          </button>
          {expandedScreenshotsId === payout.id && (
            <div className="mt-2 max-w-sm">
              <ImageUploader
                images={payout.screenshot_urls}
                onChange={(urls) => onScreenshotsChange(payout, urls)}
                maxImages={4}
                label="Proof of payment"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant={payout.is_paid ? "ghost" : "primary"} disabled={busyId === payout.id} onClick={() => onTogglePaid(payout)}>
            {busyId === payout.id ? "..." : payout.is_paid ? "Mark Unpaid" : "Mark Paid"}
          </Button>
          <button
            type="button"
            onClick={() => onDelete(payout)}
            disabled={busyId === payout.id}
            className="text-xs text-red-accent hover:underline cursor-pointer shrink-0"
          >
            Delete
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("unpaid");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [batchCategory, setBatchCategory] = useState("sotw");
  const [batchSourceDetail, setBatchSourceDetail] = useState("");
  const [batchWomCompetitionId, setBatchWomCompetitionId] = useState("");
  const [batchEventId, setBatchEventId] = useState("");
  const [rows, setRows] = useState<{ recipient_rsn: string; prize: string }[]>([{ recipient_rsn: "", prize: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const [womCompetitions, setWomCompetitions] = useState<{ id: string; title: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);

  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [editPrizeValue, setEditPrizeValue] = useState("");
  const [expandedScreenshotsId, setExpandedScreenshotsId] = useState<string | null>(null);

  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [raffleTitle, setRaffleTitle] = useState("");
  const [raffleDate, setRaffleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [creatingRaffle, setCreatingRaffle] = useState(false);
  const [expandedRaffleId, setExpandedRaffleId] = useState<string | null>(null);
  const [raffleRows, setRaffleRows] = useState<{ recipient_rsn: string; prize: string }[]>([{ recipient_rsn: "", prize: "" }]);
  const [raffleSubmitting, setRaffleSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/payouts");
    const data = await res.json().catch(() => ({}));
    setPayouts(res.ok ? data.payouts ?? [] : []);
    setLoading(false);
  }, []);

  const loadRaffles = useCallback(async () => {
    const res = await fetch("/api/admin/raffles");
    const data = await res.json().catch(() => ({}));
    setRaffles(res.ok ? data.raffles ?? [] : []);
  }, []);

  useEffect(() => {
    load();
    loadRaffles();
    (async () => {
      const [compRes, eventRes] = await Promise.all([fetch("/api/admin/wom-competitions"), fetch("/api/events")]);
      const compData = await compRes.json().catch(() => ({}));
      const eventData = await eventRes.json().catch(() => ({}));
      if (compRes.ok) setWomCompetitions((compData.competitions ?? []).map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })));
      if (eventRes.ok) setEvents((eventData.events ?? []).map((e: { id: string; title: string }) => ({ id: e.id, title: e.title })));
    })();
  }, [load, loadRaffles]);

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
      body: JSON.stringify({
        entries,
        womCompetitionId: batchCategory === "sotw" || batchCategory === "botw" ? batchWomCompetitionId || undefined : undefined,
        eventId: batchCategory === "event" ? batchEventId || undefined : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setStatus(`Added ${data.payouts?.length ?? entries.length} payout${(data.payouts?.length ?? entries.length) === 1 ? "" : "s"}.`);
      setRows([{ recipient_rsn: "", prize: "" }]);
      setBatchSourceDetail("");
      setBatchWomCompetitionId("");
      setBatchEventId("");
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

  const startEditPrize = (payout: Payout) => {
    setEditingPrizeId(payout.id);
    setEditPrizeValue(payout.prize);
  };

  const savePrize = async (payout: Payout) => {
    const prize = editPrizeValue.trim();
    if (!prize) return;
    setEditingPrizeId(null);
    await fetch(`/api/admin/payouts/${payout.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prize }),
    });
    await load();
  };

  const toggleScreenshots = (id: string) => {
    setExpandedScreenshotsId((prev) => (prev === id ? null : id));
  };

  const changeScreenshots = async (payout: Payout, urls: string[]) => {
    // Optimistic local update so the uploader's own preview grid stays in sync immediately.
    setPayouts((prev) => prev.map((p) => (p.id === payout.id ? { ...p, screenshot_urls: urls } : p)));
    await fetch(`/api/admin/payouts/${payout.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screenshot_urls: urls }),
    });
  };

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
      body: JSON.stringify({ entries, raffleId }),
    });
    if (res.ok) {
      setRaffleRows([{ recipient_rsn: "", prize: "" }]);
      setExpandedRaffleId(null);
      await load();
    }
    setRaffleSubmitting(false);
  };

  const filtered = payouts.filter((p) => {
    if (tab === "unpaid") return !p.is_paid;
    if (tab === "paid") return p.is_paid;
    return true;
  });
  const unpaidCount = payouts.filter((p) => !p.is_paid).length;

  const rowProps = {
    busyId,
    onTogglePaid: togglePaid,
    onDelete: handleDelete,
    editingPrizeId,
    editPrizeValue,
    onStartEditPrize: startEditPrize,
    onEditPrizeChange: setEditPrizeValue,
    onSavePrize: savePrize,
    expandedScreenshotsId,
    onToggleScreenshots: toggleScreenshots,
    onScreenshotsChange: changeScreenshots,
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Prize Payouts</h1>
      <p className="text-bark-brown-light mb-6">
        Track whether competition, raffle, and giveaway winners have actually been paid out. Skill/Boss of the Week
        winners from competitions with a configured payout count are added here automatically once they end.
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

          {(batchCategory === "sotw" || batchCategory === "botw") && womCompetitions.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Link to Competition (optional)</label>
              <select value={batchWomCompetitionId} onChange={(e) => setBatchWomCompetitionId(e.target.value)} className={`${inputClass} cursor-pointer`}>
                <option value="">— None —</option>
                {womCompetitions.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          )}

          {batchCategory === "event" && events.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Link to Event (optional)</label>
              <select value={batchEventId} onChange={(e) => setBatchEventId(e.target.value)} className={`${inputClass} cursor-pointer`}>
                <option value="">— None —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>
          )}

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

      {/* Raffles */}
      <Card hover={false} className="mb-8">
        <h2 className="font-display text-lg text-bark-brown mb-1">Weekly Raffles</h2>
        <p className="text-xs text-iron-grey mb-4">Create a raffle for the week, then add its winners underneath it.</p>

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
            {raffles.map((raffle) => {
              const winners = payouts.filter((p) => p.raffle_id === raffle.id);
              return (
                <div key={raffle.id} className="border border-bark-brown-light/40 rounded-md p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-bark-brown text-sm">{raffle.title}</p>
                      <p className="text-xs text-iron-grey">{new Date(raffle.occurred_on).toLocaleDateString()}</p>
                    </div>
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

                  {winners.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {winners.map((p) => (
                        <PayoutRow key={p.id} payout={p} {...rowProps} />
                      ))}
                    </div>
                  )}

                  {expandedRaffleId === raffle.id && (
                    <form onSubmit={(e) => handleAddRaffleWinners(e, raffle.id)} className="space-y-2 mt-2">
                      {raffleRows.map((row, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="text"
                            value={row.recipient_rsn}
                            onChange={(e) => updateRaffleRow(i, "recipient_rsn", e.target.value)}
                            placeholder="RSN"
                            className={`${inputClass} flex-1 font-mono`}
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
            <PayoutRow key={p.id} payout={p} {...rowProps} />
          ))}
        </div>
      )}
    </div>
  );
}
