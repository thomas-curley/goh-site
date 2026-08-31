"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { RsnAutocomplete } from "@/components/admin/RsnAutocomplete";

function normalizeRsn(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

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
  placement: number | null;
  dm_requested: boolean;
  dm_status: "sent" | "failed" | "skipped" | null;
  dm_error: string | null;
  dm_sent_at: string | null;
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
// inputClass bakes in w-full, which conflicts with an explicit width/flex
// utility (w-20, flex-1, etc.) added alongside it on the same element --
// Tailwind's generated stylesheet order (not the order classes appear in
// className) decides which width wins, so the two together are unreliable.
// This variant omits it for the few places that size themselves explicitly.
const inputClassNoWidth = inputClass.replace("w-full ", "");

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
  rollingDownId,
  rollDownValue,
  onStartRollDown,
  onRollDownChange,
  onConfirmRollDown,
  onCancelRollDown,
  rollDownSuggested,
  suggestingRollDown,
  sendingDmId,
  onSendDm,
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
  rollingDownId: string | null;
  rollDownValue: string;
  onStartRollDown: (p: Payout) => void;
  onRollDownChange: (value: string) => void;
  onConfirmRollDown: (p: Payout) => void;
  onCancelRollDown: () => void;
  rollDownSuggested: boolean;
  suggestingRollDown: boolean;
  sendingDmId: string | null;
  onSendDm: (p: Payout) => void;
}) {
  const linked = linkedSourceLabel(payout);
  const editingThisPrize = editingPrizeId === payout.id;
  const rollingDownThis = rollingDownId === payout.id;
  const sendingThisDm = sendingDmId === payout.id;

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

          <div className="flex items-center gap-2 mt-1">
            {payout.dm_status === "sent" && (
              <span className="text-xs text-gnome-green" title={payout.dm_sent_at ? new Date(payout.dm_sent_at).toLocaleString() : undefined}>
                ✓ DM sent
              </span>
            )}
            {payout.dm_status === "failed" && (
              <span className="text-xs text-red-accent" title={payout.dm_error ?? undefined}>
                ✕ DM failed{payout.dm_error ? `: ${payout.dm_error}` : ""}
              </span>
            )}
            {payout.dm_status === "skipped" && (
              <span className="text-xs text-iron-grey" title={payout.dm_error ?? undefined}>
                No linked account to DM
              </span>
            )}
            <button
              type="button"
              onClick={() => onSendDm(payout)}
              disabled={sendingThisDm || !payout.prize.trim()}
              title={!payout.prize.trim() ? "Set a prize amount first" : undefined}
              className="text-xs text-gnome-green hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
            >
              {sendingThisDm ? "Sending..." : payout.dm_status ? "Resend DM" : "Send DM"}
            </button>
          </div>

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

          {rollingDownThis && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-iron-grey">Declined — reassign to:</span>
                <input
                  autoFocus
                  type="text"
                  value={rollDownValue}
                  onChange={(e) => onRollDownChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onConfirmRollDown(payout)}
                  placeholder={suggestingRollDown ? "Looking up next place..." : "Next RSN"}
                  disabled={suggestingRollDown}
                  className="px-2 py-0.5 rounded border border-bark-brown-light bg-parchment text-text-primary text-sm font-mono w-40"
                />
                <button type="button" onClick={() => onConfirmRollDown(payout)} disabled={suggestingRollDown} className="text-xs text-gnome-green hover:underline cursor-pointer">Confirm</button>
                <button type="button" onClick={onCancelRollDown} className="text-xs text-iron-grey hover:underline cursor-pointer">Cancel</button>
              </div>
              {rollDownSuggested && !suggestingRollDown && (
                <p className="text-xs text-iron-grey mt-1">Suggested from the competition's next-placed finisher — edit if needed.</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant={payout.is_paid ? "ghost" : "primary"} disabled={busyId === payout.id} onClick={() => onTogglePaid(payout)}>
            {busyId === payout.id ? "..." : payout.is_paid ? "Mark Unpaid" : "Mark Paid"}
          </Button>
          {!payout.is_paid && (
            <button
              type="button"
              onClick={() => onStartRollDown(payout)}
              disabled={busyId === payout.id}
              className="text-xs text-gold-display hover:underline cursor-pointer shrink-0"
              title="Recipient declined -- reassign this entry to the next runner-up"
            >
              Roll Down
            </button>
          )}
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterCompetitionId = searchParams.get("competitionId");

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("unpaid");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sendingDmId, setSendingDmId] = useState<string | null>(null);
  const [notifyWinners, setNotifyWinners] = useState(false);
  const [dmTemplate, setDmTemplate] = useState("");
  const [dmTemplateDraft, setDmTemplateDraft] = useState("");
  const [showDmSettings, setShowDmSettings] = useState(false);
  const [savingDmTemplate, setSavingDmTemplate] = useState(false);
  const [roster, setRoster] = useState<string[]>([]);
  const [linkedRsns, setLinkedRsns] = useState<Set<string>>(new Set());

  const [prizePlacements, setPrizePlacements] = useState<{ placement: number; amount: number }[]>([]);
  const [prizeDefaultAmount, setPrizeDefaultAmount] = useState(0);
  const [prizeDraftPlacements, setPrizeDraftPlacements] = useState<{ placement: number; amount: number }[]>([]);
  const [prizeDraftDefaultAmount, setPrizeDraftDefaultAmount] = useState(0);
  const [showPrizeSettings, setShowPrizeSettings] = useState(false);
  const [savingPrizeDefaults, setSavingPrizeDefaults] = useState(false);

  const [batchCategory, setBatchCategory] = useState("sotw");
  const [batchSourceDetail, setBatchSourceDetail] = useState("");
  const [batchWomCompetitionId, setBatchWomCompetitionId] = useState("");
  const [batchEventId, setBatchEventId] = useState("");
  const [rows, setRows] = useState<{ recipient_rsn: string; prize: string }[]>([{ recipient_rsn: "", prize: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const [womCompetitions, setWomCompetitions] = useState<{ id: string; title: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [loadingCompetitionLeaders, setLoadingCompetitionLeaders] = useState(false);
  const [competitionLeadersStatus, setCompetitionLeadersStatus] = useState<string | null>(null);

  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [editPrizeValue, setEditPrizeValue] = useState("");
  const [expandedScreenshotsId, setExpandedScreenshotsId] = useState<string | null>(null);

  const [rollingDownId, setRollingDownId] = useState<string | null>(null);
  const [rollDownValue, setRollDownValue] = useState("");
  const [rollDownSuggested, setRollDownSuggested] = useState(false);
  const [suggestingRollDown, setSuggestingRollDown] = useState(false);

  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [raffleTitle, setRaffleTitle] = useState("");
  const [raffleDate, setRaffleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [creatingRaffle, setCreatingRaffle] = useState(false);
  const [expandedRaffleId, setExpandedRaffleId] = useState<string | null>(null);
  // Whether a raffle's winners list is shown, keyed by raffle id -- only the
  // most recent raffle starts expanded (see isRaffleExpanded below) so a
  // growing history of past raffles doesn't turn this into an endless
  // scroll; anything the admin manually toggles is remembered here.
  const [raffleWinnersExpanded, setRaffleWinnersExpanded] = useState<Record<string, boolean>>({});
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
    load();
    loadRaffles();
    loadDmTemplate();
    loadPrizeDefaults();
    (async () => {
      const [compRes, eventRes, membersRes, linkedRes] = await Promise.all([
        fetch("/api/admin/wom-competitions"),
        fetch("/api/events"),
        fetch("/api/clan-members"),
        fetch("/api/admin/payouts/linked-rsns"),
      ]);
      const compData = await compRes.json().catch(() => ({}));
      const eventData = await eventRes.json().catch(() => ({}));
      const membersData = await membersRes.json().catch(() => ({}));
      const linkedData = await linkedRes.json().catch(() => ({}));
      if (compRes.ok) setWomCompetitions((compData.competitions ?? []).map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })));
      if (eventRes.ok) setEvents((eventData.events ?? []).map((e: { id: string; title: string }) => ({ id: e.id, title: e.title })));
      if (membersRes.ok) setRoster((membersData.members ?? []).map((m: { displayName: string }) => m.displayName));
      if (linkedRes.ok) setLinkedRsns(new Set((linkedData.rsns ?? []).map((r: string) => normalizeRsn(r))));
    })();
  }, [load, loadRaffles, loadDmTemplate, loadPrizeDefaults]);

  /** "6,500,000 GP" for a given 1-based placement, per the configured defaults (explicit per-placement amount, falling back to the flat default for anything not explicitly listed). */
  const prizeForPlacement = useCallback(
    (placement: number) => {
      const amount = prizePlacements.find((p) => p.placement === placement)?.amount ?? prizeDefaultAmount;
      return amount > 0 ? `${amount.toLocaleString("en-US")} GP` : "";
    },
    [prizePlacements, prizeDefaultAmount]
  );

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

  const updateRow = (i: number, field: "recipient_rsn" | "prize", value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { recipient_rsn: "", prize: "" }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const selectCompetition = async (id: string) => {
    setBatchWomCompetitionId(id);
    setCompetitionLeadersStatus(null);
    if (!id) return;

    setLoadingCompetitionLeaders(true);
    const res = await fetch(`/api/admin/payouts/competition-leaders?competitionId=${id}`);
    const data = await res.json().catch(() => ({}));
    setLoadingCompetitionLeaders(false);

    if (!res.ok) {
      setCompetitionLeadersStatus("Couldn't load standings for that competition.");
      return;
    }
    if (!data.isEnded) {
      setCompetitionLeadersStatus("This competition hasn't ended yet -- add winners manually once it closes.");
      return;
    }
    if (!data.leaders || data.leaders.length === 0) {
      setCompetitionLeadersStatus("No participants found for this competition.");
      return;
    }

    setRows(data.leaders.map((l: { displayName: string }, i: number) => ({ recipient_rsn: l.displayName, prize: prizeForPlacement(i + 1) })));
    setCompetitionLeadersStatus(`Filled in ${data.leaders.length} finisher${data.leaders.length === 1 ? "" : "s"} from Wise Old Man with default prize amounts -- adjust below if needed.`);
  };

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
        notifyWinners,
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

  const sendDm = async (payout: Payout) => {
    setSendingDmId(payout.id);
    const res = await fetch(`/api/admin/payouts/${payout.id}/notify`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setStatus(data.error ?? "Failed to send DM.");
    await load();
    setSendingDmId(null);
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

  const startRollDown = async (payout: Payout) => {
    setRollingDownId(payout.id);
    setRollDownValue("");
    setRollDownSuggested(false);

    if (payout.wom_competition_id) {
      setSuggestingRollDown(true);
      const res = await fetch(`/api/admin/payouts/${payout.id}/suggest-next`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.suggestedRsn) {
        setRollDownValue(data.suggestedRsn);
        setRollDownSuggested(true);
      }
      setSuggestingRollDown(false);
    }
  };

  const cancelRollDown = () => setRollingDownId(null);

  const editRollDownValue = (value: string) => {
    setRollDownValue(value);
    setRollDownSuggested(false);
  };

  const confirmRollDown = async (payout: Payout) => {
    const newRsn = rollDownValue.trim();
    if (!newRsn) return;
    setRollingDownId(null);
    setBusyId(payout.id);
    await fetch(`/api/admin/payouts/${payout.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_rsn: newRsn,
        is_paid: false,
        notes: [payout.notes, `Rolled down from ${payout.recipient_rsn} (declined)`].filter(Boolean).join("\n"),
      }),
    });
    await load();
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
      body: JSON.stringify({ entries, raffleId, notifyWinners }),
    });
    if (res.ok) {
      setRaffleRows([{ recipient_rsn: "", prize: "" }]);
      setExpandedRaffleId(null);
      await load();
    }
    setRaffleSubmitting(false);
  };

  const competitionScoped = filterCompetitionId ? payouts.filter((p) => p.wom_competition_id === filterCompetitionId) : payouts;
  const filtered = competitionScoped.filter((p) => {
    if (tab === "unpaid") return !p.is_paid;
    if (tab === "paid") return p.is_paid;
    return true;
  });
  const unpaidCount = competitionScoped.filter((p) => !p.is_paid).length;
  const filterCompetitionTitle = filterCompetitionId
    ? womCompetitions.find((c) => c.id === filterCompetitionId)?.title ?? payouts.find((p) => p.wom_competition_id === filterCompetitionId)?.wom_competitions?.title
    : null;

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
    rollingDownId,
    rollDownValue,
    onStartRollDown: startRollDown,
    onRollDownChange: editRollDownValue,
    onConfirmRollDown: confirmRollDown,
    onCancelRollDown: cancelRollDown,
    rollDownSuggested,
    suggestingRollDown,
    sendingDmId,
    onSendDm: sendDm,
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Prize Payouts</h1>
      <p className="text-bark-brown-light mb-6">
        Track whether competition, raffle, and giveaway winners have actually been paid out. Skill/Boss of the Week
        winners from competitions with a configured payout count are added here automatically once they end.
      </p>

      {filterCompetitionId && (
        <div className="flex items-center justify-between gap-3 mb-6 p-3 rounded-md bg-gold/10 border border-gold/30 text-sm text-bark-brown">
          <span>Showing payouts for <span className="font-semibold">{filterCompetitionTitle ?? "this competition"}</span></span>
          <button type="button" onClick={() => router.push("/admin/payouts")} className="text-xs text-gnome-green hover:underline cursor-pointer shrink-0">
            Clear filter
          </button>
        </div>
      )}

      <Card hover={false} className="mb-8">
        <button
          type="button"
          onClick={() => setShowDmSettings((v) => !v)}
          className="w-full flex items-center justify-between gap-3 cursor-pointer"
        >
          <h2 className="font-display text-lg text-bark-brown">DM Notification Settings</h2>
          <span className="text-xs text-gnome-green">{showDmSettings ? "Hide" : "Edit template"}</span>
        </button>
        <p className="text-xs text-iron-grey mt-1">
          When notifying a winner, this message is sent as a Discord DM -- only works if their RSN is linked to a
          verified account.
        </p>

        {showDmSettings && (
          <div className="mt-4 pt-4 border-t border-parchment-dark space-y-3">
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

      <Card hover={false} className="mb-8">
        <button
          type="button"
          onClick={() => setShowPrizeSettings((v) => !v)}
          className="w-full flex items-center justify-between gap-3 cursor-pointer"
        >
          <h2 className="font-display text-lg text-bark-brown">Default Prize Structure</h2>
          <span className="text-xs text-gnome-green">{showPrizeSettings ? "Hide" : "Edit defaults"}</span>
        </button>
        <p className="text-xs text-iron-grey mt-1">
          When you link a competition above, its top finishers are pulled in with these amounts pre-filled by
          placement -- still editable per-row before you save.
        </p>

        {showPrizeSettings && (
          <div className="mt-4 pt-4 border-t border-parchment-dark space-y-3">
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
              <select
                value={batchWomCompetitionId}
                onChange={(e) => selectCompetition(e.target.value)}
                disabled={loadingCompetitionLeaders}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">— None —</option>
                {womCompetitions.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <p className="text-xs text-iron-grey mt-1">
                {loadingCompetitionLeaders
                  ? "Loading standings from Wise Old Man..."
                  : competitionLeadersStatus ?? "Picking a closed competition fills in its top finishers below automatically."}
              </p>
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
                  <RsnAutocomplete
                    value={row.recipient_rsn}
                    onChange={(value) => updateRow(i, "recipient_rsn", value)}
                    roster={roster}
                    linkedRsns={linkedRsns}
                    className={`${inputClass} font-mono`}
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

          <label className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
            <input type="checkbox" checked={notifyWinners} onChange={(e) => setNotifyWinners(e.target.checked)} className="accent-gnome-green" />
            Also notify winners via Discord DM (only sent to those with a linked, verified RSN)
          </label>

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
                    <p className="text-xs text-iron-grey mb-2">Manage payment status, screenshots, and roll-downs for these in the list below.</p>
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
