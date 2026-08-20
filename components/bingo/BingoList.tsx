"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { BingoEvent } from "@/lib/bingo";

export function BingoList() {
  const [events, setEvents] = useState<BingoEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bingo")
      .then((res) => res.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Bingo Events</h1>
      <p className="text-bark-brown-light mb-10">Team up and race to complete every tile on the board.</p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light">No bingo events right now -- check back soon.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map((event) => (
            <Link key={event.id} href={`/bingo/${event.id}`}>
              <Card className="h-full">
                {event.banner_url && (
                  <img src={event.banner_url} alt="" className="w-full h-32 object-cover rounded-md mb-3" />
                )}
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-display text-lg text-bark-brown">{event.name}</h3>
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${event.status === "active" ? "bg-gnome-green/10 text-gnome-green" : "bg-gold/10 text-gold"}`}>
                    {event.status}
                  </span>
                </div>
                {event.description && <p className="text-sm text-bark-brown-light line-clamp-2 mb-2">{event.description}</p>}
                <p className="text-xs text-iron-grey">
                  {event.grid_size}x{event.grid_size} board
                  {event.starts_at && ` · ${new Date(event.starts_at).toLocaleDateString()}${event.ends_at ? ` – ${new Date(event.ends_at).toLocaleDateString()}` : ""}`}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
