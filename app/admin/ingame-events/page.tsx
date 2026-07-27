"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EVENT_TYPES } from "@/lib/constants";

const OSRS_TYPES = ["Bossing", "Skilling", "PvP", "Social"] as const;
const OSRS_SUBTYPES = ["None", "Mass", "Wilderness", "Risky", "Serious", "Chill", "Meta", "Competition", "Rewards", "Bingo"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface SiteEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string | null;
  world: number | null;
  osrs_type: string | null;
  osrs_subtype: string | null;
  osrs_activity: string | null;
  osrs_join_rank: string | null;
  osrs_duration_days: number | null;
  osrs_added_ingame: boolean;
}

interface TranslationForm {
  osrsType: string;
  osrsSubtype: string;
  osrsActivity: string;
  osrsJoinRank: string;
  osrsDurationDays: number;
  osrsAddedIngame: boolean;
}

function formatUtcDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

function formatUtcTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function defaultOsrsType(eventType: string): string {
  if (eventType === "pvm") return "Bossing";
  if (eventType === "skilling") return "Skilling";
  return "Social";
}

function defaultDuration(ev: SiteEvent): number {
  if (!ev.end_time) return 1;
  const ms = new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function defaultForm(ev: SiteEvent): TranslationForm {
  return {
    osrsType: ev.osrs_type ?? defaultOsrsType(ev.event_type),
    osrsSubtype: ev.osrs_subtype ?? "None",
    osrsActivity: ev.osrs_activity ?? "",
    osrsJoinRank: ev.osrs_join_rank ?? "",
    osrsDurationDays: ev.osrs_duration_days ?? defaultDuration(ev),
    osrsAddedIngame: ev.osrs_added_ingame,
  };
}

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function IngameEventsPage() {
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, TranslationForm>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/events?start=${encodeURIComponent(new Date().toISOString())}`);
    const data = await res.json().catch(() => ({}));
    setEvents(res.ok ? data.events ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const formFor = (ev: SiteEvent): TranslationForm => forms[ev.id] ?? defaultForm(ev);

  const updateForm = (ev: SiteEvent, patch: Partial<TranslationForm>) => {
    setForms((prev) => ({ ...prev, [ev.id]: { ...(prev[ev.id] ?? defaultForm(ev)), ...patch } }));
  };

  const toggleExpand = (ev: SiteEvent) => {
    setExpandedId((prev) => (prev === ev.id ? null : ev.id));
    setForms((prev) => (prev[ev.id] ? prev : { ...prev, [ev.id]: defaultForm(ev) }));
  };

  const save = async (ev: SiteEvent) => {
    const form = formFor(ev);
    setSavingId(ev.id);
    const res = await fetch(`/api/events/${ev.id}/osrs-translate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        osrsType: form.osrsType,
        osrsSubtype: form.osrsSubtype,
        osrsActivity: form.osrsActivity,
        osrsJoinRank: form.osrsJoinRank,
        osrsDurationDays: Number(form.osrsDurationDays) || 1,
        osrsAddedIngame: form.osrsAddedIngame,
      }),
    });
    if (res.ok) await loadEvents();
    setSavingId(null);
  };

  const copySummary = async (ev: SiteEvent) => {
    const form = formFor(ev);
    const text = [
      `Type: ${form.osrsType}`,
      `Subtype: ${form.osrsSubtype}`,
      `Activity: ${form.osrsActivity || "(fill in)"}`,
      `Date: ${formatUtcDate(ev.start_time)}`,
      `Time: ${formatUtcTime(ev.start_time)}`,
      `Join Rank: ${form.osrsJoinRank || "(fill in)"}`,
      `World: ${ev.world ?? "(fill in)"}`,
      `Duration (Days): ${form.osrsDurationDays}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(ev.id);
      setTimeout(() => setCopiedId((prev) => (prev === ev.id ? null : prev)), 2000);
    } catch {
      // clipboard unavailable — nothing we can do
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">In-Game Events</h1>
      <p className="text-bark-brown-light mb-6">
        There&apos;s no API for OSRS&apos;s in-game &quot;Clan Home: Events&quot; panel — this translates each
        upcoming event into the exact values to type into that form (Type, Subtype, Activity, Date, Time,
        Join Rank, World, Duration). Times are shown in UTC to match the in-game clock.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">No upcoming events.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const expanded = expandedId === ev.id;
            const form = formFor(ev);
            const typeMeta = EVENT_TYPES.find((t) => t.key === ev.event_type);

            return (
              <Card key={ev.id} hover={false}>
                <button onClick={() => toggleExpand(ev)} className="w-full flex items-center justify-between gap-4 text-left cursor-pointer">
                  <div className="min-w-0">
                    <p className="font-semibold text-bark-brown truncate">
                      {ev.title}
                      {typeMeta && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeMeta.color}20`, color: typeMeta.color }}>
                          {typeMeta.name}
                        </span>
                      )}
                      {ev.osrs_added_ingame && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gnome-green/10 text-gnome-green">
                          Added in-game ✓
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-iron-grey">
                      {formatUtcDate(ev.start_time)} {formatUtcTime(ev.start_time)} UTC
                      {ev.world != null && <span> · World {ev.world}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-gnome-green shrink-0">{expanded ? "Hide" : "Translate"}</span>
                </button>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-parchment-dark space-y-4">
                    {ev.description && (
                      <p className="text-xs text-iron-grey italic">{ev.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-bark-brown mb-1">Type</label>
                        <select value={form.osrsType} onChange={(e) => updateForm(ev, { osrsType: e.target.value })} className={`${inputClass} cursor-pointer`}>
                          {OSRS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-bark-brown mb-1">Subtype</label>
                        <select value={form.osrsSubtype} onChange={(e) => updateForm(ev, { osrsSubtype: e.target.value })} className={`${inputClass} cursor-pointer`}>
                          {OSRS_SUBTYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-bark-brown mb-1">Activity</label>
                        <input type="text" value={form.osrsActivity} onChange={(e) => updateForm(ev, { osrsActivity: e.target.value })} className={inputClass} placeholder="Cerberus, Multiple Bosses, To be confirmed..." />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-bark-brown mb-1">Join Rank</label>
                        <input type="text" value={form.osrsJoinRank} onChange={(e) => updateForm(ev, { osrsJoinRank: e.target.value })} className={inputClass} placeholder="Guest" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-bark-brown mb-1">Duration (Days)</label>
                        <input type="number" min={1} value={form.osrsDurationDays} onChange={(e) => updateForm(ev, { osrsDurationDays: Number(e.target.value) || 1 })} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-bark-brown mb-1">Date / Time (UTC)</label>
                        <p className="px-3 py-2 text-sm text-bark-brown-light">
                          {formatUtcDate(ev.start_time)} — {formatUtcTime(ev.start_time)}
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.osrsAddedIngame}
                        onChange={(e) => updateForm(ev, { osrsAddedIngame: e.target.checked })}
                        className="accent-gnome-green"
                      />
                      Added to the in-game calendar
                    </label>

                    <div className="flex items-center gap-3">
                      <Button size="sm" disabled={savingId === ev.id} onClick={() => save(ev)}>
                        {savingId === ev.id ? "Saving..." : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => copySummary(ev)}>
                        {copiedId === ev.id ? "Copied!" : "Copy Summary"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
