"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { slotsForAvailabilityPoll, buildGrid, listTimeZones, detectTimeZone } from "@/lib/availability";
import { CLAN_TIMEZONE } from "@/lib/constants";
import type { AccessLevel, EligibilityResult } from "@/lib/clan-access";

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
}

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export function AvailabilityForm({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<AvailabilityPoll | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [viewTimeZone, setViewTimeZone] = useState(CLAN_TIMEZONE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [respondentName, setRespondentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paintingRef = useRef(false);
  const paintModeRef = useRef<"add" | "remove">("add");

  useEffect(() => {
    setViewTimeZone(detectTimeZone(CLAN_TIMEZONE));
  }, []);

  // The curated list covers one city per zone, but always include whatever
  // the browser actually detected (even if it's not one of the curated
  // entries) so the <select>'s value never ends up pointing at a missing
  // option.
  const timeZones = useMemo(() => {
    const base = listTimeZones();
    return base.includes(viewTimeZone) ? base : [viewTimeZone, ...base];
  }, [viewTimeZone]);

  useEffect(() => {
    fetch(`/api/availability/${pollId}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setPoll(data.poll);
          setEligibility(data.eligibility ?? { eligible: true });
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [pollId]);

  // Stop "painting" on mouseup anywhere, even if the pointer left the grid.
  useEffect(() => {
    const stop = () => { paintingRef.current = false; };
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  const slots = useMemo(
    () => (poll ? slotsForAvailabilityPoll(poll, CLAN_TIMEZONE) : []),
    [poll]
  );
  const grid = useMemo(() => buildGrid(slots, viewTimeZone, { weekdayOnly: poll?.mode === "weekly" }), [slots, viewTimeZone, poll?.mode]);

  const applyPaint = useCallback((id: string, mode: "add" | "remove") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "add") next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const startPaint = (id: string) => {
    const mode = selected.has(id) ? "remove" : "add";
    paintModeRef.current = mode;
    paintingRef.current = true;
    applyPaint(id, mode);
  };

  const continuePaint = (id: string) => {
    if (paintingRef.current) applyPaint(id, paintModeRef.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!paintingRef.current) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
    const id = el?.dataset.slot;
    if (id) continuePaint(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/availability/${pollId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: Array.from(selected), timezone: viewTimeZone, respondentName }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError(data.error ?? "Failed to submit. Try again.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !poll) {
    return (
      <Card hover={false} className="text-center py-10">
        <p className="text-bark-brown-light">Poll not found.</p>
      </Card>
    );
  }

  if (!poll.is_active) {
    return (
      <>
        <h1 className="font-display text-3xl text-gnome-green mb-4">{poll.title}</h1>
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light">This poll is closed and no longer accepting responses.</p>
        </Card>
      </>
    );
  }

  if (eligibility && !eligibility.eligible) {
    return (
      <>
        <h1 className="font-display text-3xl text-gnome-green mb-4">{poll.title}</h1>
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light mb-4">{eligibility.reason}</p>
          {eligibility.reason?.includes("signed in") ? (
            <Link href="/login" className="text-sm text-gnome-green hover:underline">Log in →</Link>
          ) : eligibility.reason?.includes("Link and verify") ? (
            <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account →</Link>
          ) : null}
        </Card>
      </>
    );
  }

  if (submitted) {
    return (
      <>
        <h1 className="font-display text-3xl text-gnome-green mb-4">{poll.title}</h1>
        <Card hover={false} className="text-center py-10">
          <p className="font-display text-xl text-bark-brown mb-2">Thanks!</p>
          <p className="text-bark-brown-light">Your availability has been recorded.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl text-gnome-green mb-1">{poll.title}</h1>
      {poll.description && <p className="text-bark-brown-light mb-6">{poll.description}</p>}

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card hover={false}>
          <label className="block text-sm font-semibold text-bark-brown mb-1">Your timezone</label>
          <select
            value={viewTimeZone}
            onChange={(e) => setViewTimeZone(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Card>

        <Card hover={false} className="overflow-x-auto">
          <p className="text-sm font-semibold text-bark-brown mb-1">Click or drag to mark when you're free</p>
          <p className="text-xs text-iron-grey mb-3">Times shown in your selected timezone above.</p>
          <table className="border-collapse text-xs select-none" onTouchMove={handleTouchMove}>
            <thead>
              <tr>
                <th className="p-1"></th>
                {grid.days.map((day) => (
                  <th key={day.key} className="p-1 text-bark-brown font-semibold whitespace-nowrap">{day.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.times.map((time) => (
                <tr key={time.minuteOfDay}>
                  <td className="p-1 text-iron-grey whitespace-nowrap pr-2 text-right">{time.label}</td>
                  {grid.days.map((day) => {
                    const id = grid.cellAt(day.key, time.minuteOfDay);
                    if (!id) return <td key={day.key} className="p-0.5"><div className="w-10 h-8" /></td>;
                    const isSelected = selected.has(id);
                    return (
                      <td key={day.key} className="p-0.5">
                        <div
                          data-slot={id}
                          onMouseDown={() => startPaint(id)}
                          onMouseEnter={() => continuePaint(id)}
                          onTouchStart={() => startPaint(id)}
                          className={`w-10 h-8 rounded border-2 cursor-pointer transition-colors ${
                            isSelected ? "bg-gnome-green border-gnome-green" : "bg-transparent border-bark-brown-light hover:border-gnome-green"
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-iron-grey mt-3">{selected.size} slot{selected.size === 1 ? "" : "s"} selected</p>
        </Card>

        {poll.access_level === "anonymous" ? (
          <Card hover={false}>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Your RSN or Discord name (optional)</label>
            <input
              type="text"
              value={respondentName}
              onChange={(e) => setRespondentName(e.target.value)}
              placeholder="Leave blank to stay anonymous"
              className={inputClass}
            />
          </Card>
        ) : (
          <Card hover={false}>
            <p className="text-sm text-bark-brown">
              Submitting as <span className="font-semibold">{eligibility?.verifiedName}</span>
            </p>
          </Card>
        )}

        <Button type="submit" disabled={submitting || selected.size === 0}>
          {submitting ? "Submitting..." : "Submit Availability"}
        </Button>
      </form>
    </>
  );
}
