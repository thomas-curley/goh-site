"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface Event {
  id: string;
  title: string;
  event_type: string;
  start_time: string;
  end_time: string | null;
  host_rsn: string | null;
  world: number | null;
  discord_event_id: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  pvm: "PvM",
  skilling: "Skilling",
  drop_party: "Drop Party",
  hide_seek: "Hide & Seek",
  social: "Social",
  other: "Other",
};

export default function AdminEventListPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, title, event_type, start_time, end_time, host_rsn, world, discord_event_id, created_at")
      .order("start_time", { ascending: false });

    if (data) setEvents(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (event: Event) => {
    const confirmed = window.confirm(`Delete "${event.title}"? This will also remove it from Discord if synced.`);
    if (!confirmed) return;

    setStatus("Deleting...");
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus(`"${event.title}" deleted.`);
      await load();
    } else {
      setStatus("Failed to delete event.");
    }
  };

  const now = new Date();

  const upcoming = events.filter((e) => new Date(e.start_time) >= now);
  const past = events.filter((e) => new Date(e.start_time) < now);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-gnome-green">All Events</h1>
        <Link href="/admin/events">
          <Button size="sm">+ Create Event</Button>
        </Link>
      </div>

      {status && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {status}
        </div>
      )}

      {/* Upcoming */}
      <section className="mb-8">
        <h2 className="font-display text-xl text-bark-brown mb-3">
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-iron-grey">No upcoming events.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((e) => (
              <EventRow key={e.id} event={e} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      <section>
        <h2 className="font-display text-xl text-bark-brown mb-3">
          Past ({past.length})
        </h2>
        {past.length === 0 ? (
          <p className="text-sm text-iron-grey">No past events.</p>
        ) : (
          <div className="space-y-2">
            {past.slice(0, 20).map((e) => (
              <EventRow key={e.id} event={e} onDelete={handleDelete} isPast />
            ))}
            {past.length > 20 && (
              <p className="text-xs text-iron-grey">Showing 20 of {past.length} past events.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function EventRow({
  event,
  onDelete,
  isPast,
}: {
  event: Event;
  onDelete: (e: Event) => void;
  isPast?: boolean;
}) {
  const startDate = new Date(event.start_time);

  return (
    <Card hover={false} className={isPast ? "opacity-70" : ""}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display text-base text-bark-brown truncate">
              {event.title}
            </h3>
            <span className="text-xs text-iron-grey shrink-0">
              {TYPE_LABELS[event.event_type] ?? event.event_type}
            </span>
            {event.discord_event_id && (
              <span className="text-xs bg-gnome-green/10 text-gnome-green px-1.5 py-0.5 rounded shrink-0">
                Discord
              </span>
            )}
          </div>
          <p className="text-xs text-iron-grey">
            {startDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {event.host_rsn && ` · Host: ${event.host_rsn}`}
            {event.world && ` · W${event.world}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onDelete(event)}
            className="text-xs text-red-accent hover:underline cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </Card>
  );
}
