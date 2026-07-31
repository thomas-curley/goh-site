"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { slotsForPoll, buildGrid, listTimeZones, detectTimeZone } from "@/lib/availability";
import { CLAN_TIMEZONE } from "@/lib/constants";

interface AvailabilityPoll {
  id: string;
  title: string;
  description: string | null;
  days: string[];
  start_minute: number;
  end_minute: number;
  slot_minutes: number;
  is_active: boolean;
}

interface AvailabilityResponse {
  id: string;
  respondent_name: string | null;
  timezone: string;
  slots: string[];
  submitted_at: string;
}

export default function AvailabilityResultsPage() {
  const params = useParams();
  const pollId = params.id as string;

  const [poll, setPoll] = useState<AvailabilityPoll | null>(null);
  const [responses, setResponses] = useState<AvailabilityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewTimeZone, setViewTimeZone] = useState(CLAN_TIMEZONE);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

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
    (async () => {
      const [pollRes, responsesRes] = await Promise.all([
        fetch(`/api/availability/${pollId}`),
        fetch(`/api/availability/${pollId}/responses`),
      ]);
      if (!pollRes.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const pollData = await pollRes.json();
      const responsesData = await responsesRes.json().catch(() => ({}));
      setPoll(pollData.poll);
      setResponses(responsesRes.ok ? responsesData.responses ?? [] : []);
      setLoading(false);
    })();
  }, [pollId]);

  const slots = useMemo(
    () => (poll ? slotsForPoll(poll.days, poll.start_minute, poll.end_minute, poll.slot_minutes, CLAN_TIMEZONE) : []),
    [poll]
  );

  const grid = useMemo(() => buildGrid(slots, viewTimeZone), [slots, viewTimeZone]);

  const { countBySlot, namesBySlot, maxCount } = useMemo(() => {
    const counts = new Map<string, number>();
    const names = new Map<string, string[]>();
    for (const slot of slots) {
      counts.set(slot, 0);
      names.set(slot, []);
    }
    for (const response of responses) {
      const label = response.respondent_name || "Anonymous";
      for (const iso of response.slots) {
        if (!counts.has(iso)) continue; // ignore anything outside the poll's current grid (e.g. after an edit)
        counts.set(iso, (counts.get(iso) ?? 0) + 1);
        names.get(iso)?.push(label);
      }
    }
    const max = Math.max(0, ...Array.from(counts.values()));
    return { countBySlot: counts, namesBySlot: names, maxCount: max };
  }, [slots, responses]);

  const topSlots = useMemo(() => {
    return Array.from(countBySlot.entries())
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [countBySlot]);

  const formatSlotLabel = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: viewTimeZone })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: viewTimeZone })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !poll) {
    return <p className="text-bark-brown-light">Poll not found.</p>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">{poll.title}</h1>
      {poll.description && <p className="text-bark-brown-light mb-2">{poll.description}</p>}
      <p className="text-sm text-iron-grey mb-6">
        {responses.length} response{responses.length === 1 ? "" : "s"}
        {!poll.is_active && <span className="ml-2 text-xs">(Closed)</span>}
      </p>

      <Card hover={false} className="mb-6">
        <label className="block text-sm font-semibold text-bark-brown mb-1">View grid in</label>
        <select
          value={viewTimeZone}
          onChange={(e) => setViewTimeZone(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
        >
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
          ))}
        </select>
      </Card>

      {topSlots.length > 0 && (
        <Card hover={false} className="mb-6">
          <h3 className="font-display text-lg text-bark-brown mb-3">Top Time Slots</h3>
          <ol className="space-y-2">
            {topSlots.map(([iso, count], i) => (
              <li key={iso} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-bark-brown">
                  <span className="font-semibold text-gnome-green mr-2">#{i + 1}</span>
                  {formatSlotLabel(iso)}
                </span>
                <span className="text-iron-grey shrink-0">
                  {count}/{responses.length} available
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card hover={false} className="mb-6 overflow-x-auto">
        <h3 className="font-display text-lg text-bark-brown mb-3">Heatmap</h3>
        {responses.length === 0 ? (
          <p className="text-sm text-iron-grey">No responses yet.</p>
        ) : (
          <table className="border-collapse text-xs">
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
                    const iso = grid.cellAt(day.key, time.minuteOfDay);
                    const count = iso ? countBySlot.get(iso) ?? 0 : 0;
                    const intensity = maxCount > 0 ? count / maxCount : 0;
                    return (
                      <td key={day.key} className="p-0.5">
                        {iso ? (
                          <button
                            type="button"
                            onClick={() => setSelectedSlot(iso)}
                            title={`${count} available`}
                            className={`w-9 h-7 rounded border cursor-pointer transition-transform hover:scale-110 ${
                              selectedSlot === iso ? "border-gnome-green border-2" : "border-parchment-dark"
                            }`}
                            style={{
                              backgroundColor:
                                count > 0
                                  ? `color-mix(in srgb, var(--color-gnome-green) ${Math.round((0.15 + intensity * 0.85) * 100)}%, var(--color-parchment-dark))`
                                  : "var(--color-parchment-dark)",
                            }}
                          />
                        ) : (
                          <div className="w-9 h-7" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selectedSlot && (
        <Card hover={false}>
          <h3 className="font-display text-base text-bark-brown mb-2">{formatSlotLabel(selectedSlot)}</h3>
          {(namesBySlot.get(selectedSlot) ?? []).length === 0 ? (
            <p className="text-sm text-iron-grey">No one selected this slot.</p>
          ) : (
            <ul className="text-sm text-bark-brown space-y-0.5">
              {(namesBySlot.get(selectedSlot) ?? []).map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
