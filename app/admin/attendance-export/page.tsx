"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Preset = "week" | "month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

interface Attendee {
  name: string;
  count: number;
}

function presetRange(preset: Preset): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (preset === "week") start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

const inputClass = "px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function AttendanceExportPage() {
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

  const load = useCallback(async (start: string, end: string) => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const params = new URLSearchParams({ start, end });
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

  const selectPreset = (p: Preset) => {
    setPreset(p);
    const { start, end } = presetRange(p);
    load(start, end);
  };

  const applyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    setPreset("custom");
    load(new Date(customStart).toISOString(), new Date(`${customEnd}T23:59:59`).toISOString());
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
      <h1 className="font-display text-3xl text-gnome-green mb-1">Attendance Export</h1>
      <p className="text-bark-brown-light mb-6">
        Pull attendee names from a date range of events, ready to paste into a raffle wheel or spreadsheet.
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
    </div>
  );
}
