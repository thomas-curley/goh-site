"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EVENT_TYPES } from "@/lib/constants";

interface EventForm {
  title: string;
  description: string;
  event_type: string;
  start_time: string;
  end_time: string;
  host_rsn: string;
  world: string;
  location: string;
  requirements: string;
  prize_pool: string;
}

const EMPTY_FORM: EventForm = {
  title: "",
  description: "",
  event_type: "other",
  start_time: "",
  end_time: "",
  host_rsn: "",
  world: "",
  location: "",
  requirements: "",
  prize_pool: "",
};

export default function AdminEventsPage() {
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [status, setStatus] = useState<string | null>(null);

  const updateField = (field: keyof EventForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Submitting...");

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          world: form.world ? parseInt(form.world) : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("Event created! (Will persist once Supabase is connected)");
        setForm(EMPTY_FORM);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch {
      setStatus("Failed to submit event.");
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-6">
        Manage Events
      </h1>

      <Card hover={false}>
        <h2 className="font-display text-xl text-bark-brown mb-4">
          Create New Event
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">
              Event Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green"
              placeholder="Weekly PvM Bingo"
            />
          </div>

          {/* Event Type + Start/End */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">
                Event Type
              </label>
              <select
                value={form.event_type}
                onChange={(e) => updateField("event_type", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={(e) => updateField("start_time", e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={(e) => updateField("end_time", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green resize-y"
              placeholder="Details about the event..."
            />
          </div>

          {/* Host, World, Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">
                Host RSN
              </label>
              <input
                type="text"
                value={form.host_rsn}
                onChange={(e) => updateField("host_rsn", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green font-mono"
                placeholder="Tmansim21"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">
                World
              </label>
              <input
                type="number"
                value={form.world}
                onChange={(e) => updateField("world", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green"
                placeholder="420"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green"
                placeholder="Grand Exchange"
              />
            </div>
          </div>

          {/* Requirements + Prize Pool */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">
                Requirements
              </label>
              <input
                type="text"
                value={form.requirements}
                onChange={(e) => updateField("requirements", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green"
                placeholder="70+ combat, bring own supplies"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">
                Prize Pool
              </label>
              <input
                type="text"
                value={form.prize_pool}
                onChange={(e) => updateField("prize_pool", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green"
                placeholder="50M GP"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <Button type="submit">Create Event</Button>
            {status && (
              <span className="text-sm text-bark-brown-light">{status}</span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
