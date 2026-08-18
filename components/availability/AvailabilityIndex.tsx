"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ACCESS_LEVEL_LABELS, type AccessLevel } from "@/lib/clan-access";
import { WEEKDAY_LABELS } from "@/lib/availability";

interface AvailabilityPoll {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  access_level: AccessLevel;
  mode: "dates" | "weekly";
  days: string[] | null;
  weekdays: string[] | null;
}

export function AvailabilityIndex() {
  const [polls, setPolls] = useState<AvailabilityPoll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/availability")
      .then((res) => res.json())
      .then((data) => setPolls(data.polls ?? []))
      .catch(() => setPolls([]))
      .finally(() => setLoading(false));
  }, []);

  const active = polls.filter((p) => p.is_active);
  const closed = polls.filter((p) => !p.is_active);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-display text-3xl text-gnome-green mb-1">Availability</h1>
      <p className="text-bark-brown-light mb-8">
        Fill in when you're free so we can find the best time for an event. Pick your own timezone -- everything shown adjusts to it.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : polls.length === 0 ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light">No availability polls right now — check back soon.</p>
        </Card>
      ) : (
        <>
          <section className="space-y-3 mb-10">
            {active.length === 0 ? (
              <Card hover={false}>
                <p className="text-sm text-iron-grey">No active polls right now.</p>
              </Card>
            ) : (
              active.map((poll) => <PollRow key={poll.id} poll={poll} />)
            )}
          </section>

          {closed.length > 0 && (
            <section>
              <h2 className="font-display text-lg text-bark-brown-light mb-3">Closed</h2>
              <div className="space-y-3 opacity-60">
                {closed.map((poll) => <PollRow key={poll.id} poll={poll} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PollRow({ poll }: { poll: AvailabilityPoll }) {
  return (
    <Link href={`/availability/${poll.id}`}>
      <Card className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-bark-brown truncate">
            {poll.title}
            {poll.access_level !== "anonymous" && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gnome-green/10 text-gnome-green align-middle">
                {ACCESS_LEVEL_LABELS[poll.access_level]}
              </span>
            )}
          </h3>
          {poll.description && <p className="text-xs text-bark-brown-light truncate">{poll.description}</p>}
          <p className="text-xs text-iron-grey">
            {poll.mode === "weekly"
              ? `Recurring · ${(poll.weekdays ?? []).map((d) => WEEKDAY_LABELS[d]?.slice(0, 3) ?? d).join("/")}`
              : `${(poll.days ?? []).length} day${(poll.days ?? []).length === 1 ? "" : "s"} of options`}
          </p>
        </div>
        {poll.is_active && <span className="text-sm text-gnome-green shrink-0">Fill In &rarr;</span>}
      </Card>
    </Link>
  );
}
