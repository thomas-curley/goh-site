"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { BingoEvent } from "@/lib/bingo";

const STATUS_STYLES: Record<BingoEvent["status"], string> = {
  draft: "bg-iron-grey/10 text-iron-grey",
  active: "bg-gnome-green/10 text-gnome-green",
  completed: "bg-gold/10 text-gold",
};

export default function BingoEventListPage() {
  const [events, setEvents] = useState<BingoEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/bingo");
    const data = await res.json().catch(() => ({}));
    setEvents(res.ok ? data.events ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="font-display text-3xl text-gnome-green">Bingo Events</h1>
        <Link href="/admin/bingo"><Button>+ New Event</Button></Link>
      </div>
      <p className="text-bark-brown-light mb-6">Every bingo board created from this site.</p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <Card hover={false}><p className="text-sm text-iron-grey">No bingo events yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} hover={false}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-bark-brown truncate">
                    {event.name}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded capitalize align-middle ${STATUS_STYLES[event.status]}`}>{event.status}</span>
                  </p>
                  <p className="text-xs text-iron-grey">
                    {event.grid_size}x{event.grid_size}
                    {event.starts_at && ` · ${new Date(event.starts_at).toLocaleDateString()}${event.ends_at ? ` – ${new Date(event.ends_at).toLocaleDateString()}` : ""}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/admin/bingo/${event.id}/review`}><Button size="sm" variant="ghost">Review</Button></Link>
                  <Link href={`/admin/bingo/${event.id}/edit`}><Button size="sm" variant="ghost">Edit</Button></Link>
                  <Link href={`/bingo/${event.id}`}><Button size="sm" variant="ghost">View</Button></Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
