"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ACCESS_LEVEL_LABELS, type AccessLevel } from "@/lib/clan-access";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/availability";
import type { WeekdayAvailability } from "@/app/api/admin/availability/weekly/route";

interface AvailabilityPoll {
  id: string;
  title: string;
  description: string | null;
  mode: "dates" | "weekly";
  days: string[] | null;
  weekdays: string[] | null;
  start_minute: number;
  end_minute: number;
  slot_minutes: number;
  access_level: AccessLevel;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

const ACCESS_LEVELS: AccessLevel[] = ["anonymous", "verified_player", "clan_member"];
const SLOT_LENGTHS = [15, 30, 60];
const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

function minutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeInputToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminAvailabilityPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("anonymous");
  const [mode, setMode] = useState<"dates" | "weekly">("dates");
  const [days, setDays] = useState<string[]>([todayStr()]);
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("22:00");
  const [slotMinutes, setSlotMinutes] = useState(30);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [polls, setPolls] = useState<AvailabilityPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [weeklyAvailability, setWeeklyAvailability] = useState<WeekdayAvailability[]>([]);
  const [respondedCount, setRespondedCount] = useState(0);
  const [totalLinked, setTotalLinked] = useState(0);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const loadPolls = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/availability");
    const data = await res.json().catch(() => ({}));
    setPolls(res.ok ? data.polls ?? [] : []);
    setLoading(false);
  }, []);

  const loadWeeklyAvailability = useCallback(async () => {
    setWeeklyLoading(true);
    const res = await fetch("/api/admin/availability/weekly");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setWeeklyAvailability(data.weekdays ?? []);
      setRespondedCount(data.respondedCount ?? 0);
      setTotalLinked(data.totalLinked ?? 0);
    }
    setWeeklyLoading(false);
  }, []);

  useEffect(() => { loadPolls(); }, [loadPolls]);
  useEffect(() => { loadWeeklyAvailability(); }, [loadWeeklyAvailability]);

  const updateDay = (i: number, value: string) => setDays((prev) => prev.map((d, idx) => (idx === i ? value : d)));
  const addDay = () => setDays((prev) => [...prev, todayStr()]);
  const removeDay = (i: number) => setDays((prev) => prev.filter((_, idx) => idx !== i));
  const toggleWeekday = (day: string) =>
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAccessLevel("anonymous");
    setMode("dates");
    setDays([todayStr()]);
    setWeekdays([]);
    setStartTime("18:00");
    setEndTime("22:00");
    setSlotMinutes(30);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setStatus(null);

    const startMinute = timeInputToMinutes(startTime);
    const endMinute = timeInputToMinutes(endTime);
    if (endMinute <= startMinute) {
      setError("End time must be after the start time.");
      setSubmitting(false);
      return;
    }
    if (mode === "weekly" && weekdays.length === 0) {
      setError("Pick at least one day of the week.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, accessLevel, mode, days, weekdays, startMinute, endMinute, slotMinutes }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setStatus(`Poll created. Share it at /availability/${data.id}`);
      resetForm();
      await loadPolls();
    } else {
      setError(data.error ?? "Failed to create poll.");
    }
    setSubmitting(false);
  };

  const toggleActive = async (poll: AvailabilityPoll) => {
    setTogglingId(poll.id);
    await fetch(`/api/availability/${poll.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !poll.is_active }),
    });
    await loadPolls();
    setTogglingId(null);
  };

  const handleDelete = async (poll: AvailabilityPoll) => {
    if (!confirm(`Delete "${poll.title}" and all its responses? This can't be undone.`)) return;
    setDeletingId(poll.id);
    await fetch(`/api/availability/${poll.id}`, { method: "DELETE" });
    await loadPolls();
    setDeletingId(null);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Availability Polls</h1>
      <p className="text-bark-brown-light mb-6">
        Pick candidate days and a time window, share the link, and review the results as a heatmap to find the best time for an event.
      </p>

      <Card hover={false} className="mb-8">
        <h3 className="font-display text-lg text-bark-brown mb-1">Clan-Wide Weekly Availability</h3>
        <p className="text-xs text-iron-grey mb-4">
          Standing, recurring availability members set on their own Account page -- not tied to a poll.
        </p>

        {weeklyLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
          </div>
        ) : respondedCount === 0 ? (
          <p className="text-sm text-iron-grey">
            No one has set their weekly availability yet — it&apos;s on their Account page.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {weeklyAvailability.map((d) => {
                const maxCount = Math.max(1, ...weeklyAvailability.map((w) => w.count));
                return (
                  <div key={d.weekday}>
                    <button
                      type="button"
                      onClick={() => setExpandedDay((prev) => (prev === d.weekday ? null : d.weekday))}
                      className="w-full text-left cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-bark-brown mb-1">{WEEKDAY_LABELS[d.weekday]}</p>
                      <div className="h-2 rounded-full bg-parchment-dark overflow-hidden mb-1">
                        <div
                          className="h-full bg-gnome-green rounded-full"
                          style={{ width: `${(d.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm font-stats text-gnome-green">{d.count}</p>
                    </button>
                    {expandedDay === d.weekday && (
                      <ul className="mt-2 space-y-0.5">
                        {d.members.length === 0 ? (
                          <li className="text-xs text-iron-grey">No one</li>
                        ) : (
                          d.members.map((m, i) => (
                            <li key={i} className="text-xs text-bark-brown-light truncate">
                              {m.rsn ?? m.discordUsername}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-iron-grey mt-4">
              Based on {respondedCount} of {totalLinked} linked members who&apos;ve set their availability.
            </p>
          </>
        )}
      </Card>

      <Card hover={false} className="mb-8">
        <h3 className="font-display text-lg text-bark-brown mb-4">New Poll</h3>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>
        )}
        {status && (
          <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} placeholder="When's good for the boss mass?" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Access</label>
            <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as AccessLevel)} className={`${inputClass} cursor-pointer`}>
              {ACCESS_LEVELS.map((level) => (
                <option key={level} value={level}>{ACCESS_LEVEL_LABELS[level]}</option>
              ))}
            </select>
            {accessLevel !== "anonymous" && (
              <p className="text-xs text-iron-grey mt-1">
                Respondents must link and verify an RSN{accessLevel === "clan_member" ? ", and it must be a current clan member" : ""}. Their identity is recorded with each response.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-2">When</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
                <input type="radio" checked={mode === "dates"} onChange={() => setMode("dates")} className="accent-gnome-green" />
                Specific dates
              </label>
              <label className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
                <input type="radio" checked={mode === "weekly"} onChange={() => setMode("weekly")} className="accent-gnome-green" />
                Days of the week (recurring)
              </label>
            </div>

            {mode === "dates" ? (
              <>
                <div className="space-y-1.5">
                  {days.map((day, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="date" value={day} onChange={(e) => updateDay(i, e.target.value)} className={inputClass} />
                      {days.length > 1 && (
                        <button type="button" onClick={() => removeDay(i)} className="text-red-accent text-xs cursor-pointer shrink-0 px-2">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addDay} className="text-xs text-gnome-green hover:underline mt-2 cursor-pointer">+ Add day</button>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={`px-3 py-1.5 rounded-md border-2 text-sm font-semibold transition-colors cursor-pointer ${
                        weekdays.includes(day)
                          ? "bg-gnome-green/15 border-gnome-green text-gnome-green"
                          : "border-bark-brown-light text-bark-brown-light hover:border-gnome-green"
                      }`}
                    >
                      {WEEKDAY_LABELS[day]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-iron-grey mt-2">
                  Not tied to a specific week -- stays open and gauges a standing weekly pattern (e.g. which weeknight usually works) rather than one event's date.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-bark-brown mb-1">Earliest Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-bark-brown mb-1">Latest Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-bark-brown mb-1">Slot Length</label>
              <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className={`${inputClass} cursor-pointer`}>
                {SLOT_LENGTHS.map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-iron-grey">
            Times are in your clan's reference timezone (Eastern) -- respondents see them converted to whatever timezone they pick.
          </p>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Poll"}
          </Button>
        </form>
      </Card>

      <h3 className="font-display text-lg text-bark-brown mb-4">Existing Polls</h3>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : polls.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">No availability polls yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => (
            <Card key={poll.id} hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-bark-brown truncate">
                    {poll.title}
                    {!poll.is_active && <span className="ml-2 text-xs text-iron-grey">(Closed)</span>}
                    {poll.access_level !== "anonymous" && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gnome-green/10 text-gnome-green align-middle">
                        {ACCESS_LEVEL_LABELS[poll.access_level]}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-iron-grey">
                    {poll.mode === "weekly"
                      ? (poll.weekdays ?? []).map((d) => WEEKDAY_LABELS[d]?.slice(0, 3) ?? d).join("/")
                      : `${(poll.days ?? []).length} day${(poll.days ?? []).length === 1 ? "" : "s"}`}
                    {" · "}{minutesToTimeInput(poll.start_minute)}–{minutesToTimeInput(poll.end_minute)} ET
                    {poll.mode === "weekly" && <span> · recurring</span>}
                    {poll.created_by && <span> · by {poll.created_by}</span>}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <Link href={`/availability/${poll.id}`} target="_blank" className="text-xs text-gnome-green hover:underline">
                      Open poll link →
                    </Link>
                    <Link href={`/admin/availability/${poll.id}`} className="text-xs text-gnome-green hover:underline">
                      View Results →
                    </Link>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" disabled={togglingId === poll.id} onClick={() => toggleActive(poll)}>
                    {togglingId === poll.id ? "..." : poll.is_active ? "Close" : "Reopen"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={deletingId === poll.id} onClick={() => handleDelete(poll)}>
                    {deletingId === poll.id ? "..." : "Delete"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
