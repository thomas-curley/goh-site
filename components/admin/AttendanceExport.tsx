"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { drawWinners, presetDates, rangeFromDates, type RafflePreset } from "@/lib/raffle";

type Preset = RafflePreset | "custom";

const PRESETS: { key: RafflePreset; label: string }[] = [
  { key: "lastWeek", label: "Last Week" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

interface Attendee {
  name: string;
  count: number;
}

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const inputClass = "px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

/** "Oct 11" */
function shortDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Attendee names for a date range of events, and the weekly raffle draw.
 * Shown on the Raffles page; a draw can be saved as that week's raffle
 * (winners go to Prize Payouts), which the Weekly SOTW/BotW page then
 * picks up for its raffle post.
 */
export function AttendanceExport({ defaultPrizeAmount = null, onRaffleSaved }: { defaultPrizeAmount?: number | null; onRaffleSaved?: () => void }) {
  const [preset, setPreset] = useState<Preset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [mode, setMode] = useState<"unique" | "weighted">("weighted");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [winnerCount, setWinnerCount] = useState(1);
  const [winners, setWinners] = useState<Attendee[]>([]);
  const [winnersCopied, setWinnersCopied] = useState(false);
  // "Save as raffle" form. The title follows the range until it's typed in.
  const [raffleTitle, setRaffleTitle] = useState<string | null>(null);
  const [prize, setPrize] = useState<string | null>(null);
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    setCopied(false);
    setWinners([]);
    setSaved(null);
    setRaffleTitle(null);
    setRange({ from, to });
    try {
      const params = new URLSearchParams(rangeFromDates(from, to));
      const res = await fetch(`/api/attendance/export?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setAttendees(data.attendees ?? []);
        setTotalEvents(data.total_events ?? 0);
        setLoaded(true);
      } else {
        setError(data.error ?? "Failed to load attendance.");
      }
    } catch {
      setError("Failed to load attendance.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Presets fill in the date pickers with the range they use.
  const selectPreset = (p: RafflePreset) => {
    setPreset(p);
    const { from, to } = presetDates(p);
    setCustomStart(from);
    setCustomEnd(to);
    load(from, to);
  };

  const applyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    if (customEnd < customStart) {
      setError("The To date is before the From date.");
      return;
    }
    setPreset("custom");
    load(customStart, customEnd);
  };

  const totalEntries = attendees.reduce((sum, a) => sum + a.count, 0);

  const draw = () => {
    setWinners(drawWinners(attendees, Math.max(1, Math.min(winnerCount, attendees.length))));
    setWinnersCopied(false);
    setSaved(null);
  };

  const titleValue = raffleTitle ?? (range ? `Raffle: ${shortDay(range.from)} – ${shortDay(range.to)}` : "Weekly raffle");
  const prizeValue = prize ?? `${(defaultPrizeAmount ?? 1_000_000).toLocaleString("en-US")} GP`;

  // Creates the raffle, then adds the winners to it through Prize Payouts
  // (the same path as adding winners by hand).
  const saveRaffle = async () => {
    if (!range || winners.length === 0 || !titleValue.trim() || !prizeValue.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/raffles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleValue.trim(), occurredOn: range.to }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.raffle?.id) {
      setSaving(false);
      return setError(data.error ?? "Couldn't create the raffle.");
    }
    const winnersRes = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: winners.map((w) => ({ recipient_rsn: w.name, prize: prizeValue.trim(), category: "raffle" })),
        raffleId: data.raffle.id,
        notifyWinners: notify,
      }),
    });
    setSaving(false);
    if (!winnersRes.ok) {
      const w = await winnersRes.json().catch(() => ({}));
      setError(`The raffle was created, but its winners couldn't be saved (${w.error ?? "unknown error"}). Add them with "+ Add Winner" on it below.`);
    } else {
      setSaved(titleValue.trim());
    }
    onRaffleSaved?.();
  };

  const copyWinners = async () => {
    try {
      await navigator.clipboard.writeText(winners.map((w) => w.name).join("\n"));
      setWinnersCopied(true);
      setTimeout(() => setWinnersCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically -- select the winners and copy manually.");
    }
  };

  const nameList = mode === "unique"
    ? attendees.map((a) => a.name)
    : attendees.flatMap((a) => Array.from({ length: a.count }, () => a.name));

  const listText = nameList.join("\n");

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(listText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically — click the list above and copy manually.");
    }
  };

  return (
    <div>
      <h2 className="font-display text-xl text-bark-brown mb-1">Draw the weekly raffle</h2>
      <p className="text-sm text-bark-brown-light mb-4">
        Pick the week, then draw winners from everyone who attended events in it. You can also copy the name list for a raffle wheel.
      </p>

      <Card hover={false} className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {PRESETS.map((p) => (
            <Button key={p.key} size="sm" variant={preset === p.key ? "primary" : "ghost"} onClick={() => selectPreset(p.key)}>
              {p.label}
            </Button>
          ))}
        </div>
        <form onSubmit={applyCustomRange} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-iron-grey mb-1">From</label>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-iron-grey mb-1">To</label>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" size="sm" variant={preset === "custom" ? "primary" : "secondary"}>
            Apply Range
          </Button>
        </form>
        <p className="text-xs text-iron-grey mt-2">
          {range
            ? `Showing events from ${formatDay(range.from)} to ${formatDay(range.to)} (both days included).`
            : "Weeks run Sunday to Saturday; This Month is the whole calendar month. Each button fills in the dates above."}
        </p>
      </Card>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : loaded && (
        <Card hover={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-iron-grey">
              {totalEvents} event{totalEvents === 1 ? "" : "s"} · {attendees.length} unique attendee{attendees.length === 1 ? "" : "s"} · {nameList.length} name{nameList.length === 1 ? "" : "s"} in list
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={mode === "weighted" ? "primary" : "ghost"} onClick={() => setMode("weighted")} title="Each attendee appears once per event they attended -- more events, more entries">
                Weighted by Attendance
              </Button>
              <Button size="sm" variant={mode === "unique" ? "primary" : "ghost"} onClick={() => setMode("unique")}>
                Unique Names Only
              </Button>
            </div>
          </div>

          {nameList.length === 0 ? (
            <p className="text-sm text-iron-grey">No attendance recorded for this range.</p>
          ) : (
            <>
              <textarea
                readOnly
                value={listText}
                rows={14}
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gnome-green"
                onFocus={(e) => e.target.select()}
              />
              <div className="flex items-center gap-3 mt-3">
                <Button size="sm" onClick={copyToClipboard}>
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <p className="text-xs text-iron-grey">One name per line, ready to paste into wheelofnames.com or similar.</p>
              </div>
            </>
          )}
        </Card>
      )}

      {!loading && loaded && attendees.length > 0 && (
        <Card hover={false} className="mt-6">
          <h3 className="font-display text-lg text-bark-brown mb-1">Random draw</h3>
          <p className="text-sm text-bark-brown-light mb-3">
            Picks different winners from this list. Everyone gets one entry per event they attended in this range ({totalEntries} entries
            across {attendees.length} {attendees.length === 1 ? "person" : "people"}), and a winner&apos;s entries leave the draw so nobody wins twice.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="winner-count" className="block text-xs text-iron-grey mb-1">Number of winners</label>
              <input
                id="winner-count"
                type="number"
                min={1}
                max={attendees.length}
                value={winnerCount}
                onChange={(e) => setWinnerCount(Math.max(1, Math.min(Number(e.target.value) || 1, attendees.length)))}
                className={`${inputClass} w-28`}
              />
            </div>
            <Button size="sm" onClick={draw}>{winners.length ? "Draw again" : "Draw winners"}</Button>
          </div>
          {winners.length > 0 && (
            <div className="mt-4">
              <ol className="space-y-1">
                {winners.map((w, i) => (
                  <li key={w.name} className="flex items-baseline gap-2 text-bark-brown">
                    <span className="font-display text-gold w-6 text-right">{i + 1}.</span>
                    <span className="font-semibold">{w.name}</span>
                    <span className="text-xs text-iron-grey">
                      {w.count} {w.count === 1 ? "entry" : "entries"}
                    </span>
                  </li>
                ))}
              </ol>
              <Button size="sm" variant="secondary" className="mt-3" onClick={copyWinners}>
                {winnersCopied ? "Copied!" : "Copy winners"}
              </Button>

              <div className="mt-5 border-t border-bark-brown-light/30 pt-4">
                {saved ? (
                  <p className="text-sm text-gnome-green">
                    Saved as <span className="font-semibold">{saved}</span>. The winners are in Prize Payouts, and the Weekly SOTW/BotW page will
                    fill its raffle post from it.
                  </p>
                ) : (
                  <>
                    <h4 className="font-semibold text-bark-brown text-sm mb-1">Save as this week&apos;s raffle</h4>
                    <p className="text-xs text-iron-grey mb-3">
                      Adds the raffle to the list on this page with these winners (unpaid in Prize Payouts). The Weekly SOTW/BotW post pulls the
                      winners from the latest raffle.
                    </p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-48">
                        <label htmlFor="raffle-title" className="block text-xs text-iron-grey mb-1">Raffle name</label>
                        <input id="raffle-title" value={titleValue} maxLength={120} onChange={(e) => setRaffleTitle(e.target.value)} className={`${inputClass} w-full`} />
                      </div>
                      <div>
                        <label htmlFor="raffle-prize" className="block text-xs text-iron-grey mb-1">Prize per winner</label>
                        <input id="raffle-prize" value={prizeValue} onChange={(e) => setPrize(e.target.value)} className={`${inputClass} w-40`} />
                      </div>
                      <Button size="sm" disabled={saving || !titleValue.trim() || !prizeValue.trim()} onClick={saveRaffle}>
                        {saving ? "Saving..." : `Save raffle with ${winners.length} ${winners.length === 1 ? "winner" : "winners"}`}
                      </Button>
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-xs text-bark-brown cursor-pointer">
                      <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-gnome-green" />
                      Also tell the winners by Discord DM
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
