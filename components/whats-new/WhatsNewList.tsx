"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WhatsNewAudience, WhatsNewEntry, WhatsNewKind } from "@/content/whats-new";
import { WHATS_NEW_EVENT, getSeenIds, markSeen, setWalkthrough } from "@/lib/whats-new-state";

const KIND_STYLES: Record<WhatsNewKind, { label: string; className: string }> = {
  new: { label: "New", className: "bg-gnome-green/15 text-gnome-green" },
  improved: { label: "Improved", className: "bg-gold/20 text-bark-brown" },
  fixed: { label: "Fixed", className: "bg-iron-grey/15 text-bark-brown" },
  privacy: { label: "Privacy", className: "bg-red-accent/10 text-red-accent" },
};

const AUDIENCE_LABELS: Record<WhatsNewAudience, string> = {
  everyone: "Everyone can see this",
  staff: "Staff",
  admin: "Admin panel",
};

type Filter = "all" | "unseen" | WhatsNewAudience;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unseen", label: "Not seen yet" },
  { key: "everyone", label: "For everyone" },
  { key: "staff", label: "For staff" },
  { key: "admin", label: "Admin panel" },
];

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function WhatsNewList({ entries }: { entries: WhatsNewEntry[] }) {
  const router = useRouter();
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const sync = () => setSeen(getSeenIds());
    const frame = requestAnimationFrame(sync);
    window.addEventListener(WHATS_NEW_EVENT, sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(WHATS_NEW_EVENT, sync);
    };
  }, []);

  const isUnseen = (e: WhatsNewEntry) => seen !== null && !seen.has(e.id);
  const unseen = entries.filter(isUnseen);
  const visible = entries.filter((e) => (filter === "all" ? true : filter === "unseen" ? isUnseen(e) : e.audience === filter));

  const days: { date: string; entries: WhatsNewEntry[] }[] = [];
  for (const e of visible) {
    const day = days.find((d) => d.date === e.date);
    if (day) day.entries.push(e);
    else days.push({ date: e.date, entries: [e] });
  }

  const startWalkthrough = (list: WhatsNewEntry[], startAt = 0) => {
    const tour = list.filter((e) => e.links.length > 0);
    if (tour.length === 0) return;
    setWalkthrough({ ids: tour.map((e) => e.id), index: Math.min(startAt, tour.length - 1) });
    router.push(tour[Math.min(startAt, tour.length - 1)].links[0].href);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gnome-green/40 bg-gnome-green/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-bark-brown">
            {seen === null ? "Loading…" : unseen.length > 0 ? `${unseen.length} change${unseen.length === 1 ? "" : "s"} you haven't seen yet` : "You're all caught up"}
          </p>
          <p className="text-sm text-bark-brown-light">
            The walkthrough takes you to each page in turn, with a small guide in the corner telling you what to look at.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => startWalkthrough(unseen.length > 0 ? unseen : entries)}
            className="rounded-md bg-gnome-green px-4 py-2 text-sm font-semibold text-white hover:bg-gnome-green-light cursor-pointer"
          >
            {unseen.length > 0 ? "Start walkthrough" : "Walk through everything"}
          </button>
          {unseen.length > 0 && (
            <button
              type="button"
              onClick={() => markSeen(unseen.map((e) => e.id))}
              className="rounded-md border border-bark-brown-light px-3 py-2 text-sm text-bark-brown hover:bg-parchment-dark cursor-pointer"
            >
              Mark all as seen
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter changes">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full border px-3 py-1 text-sm cursor-pointer transition-colors ${
              filter === f.key ? "border-gnome-green bg-gnome-green text-white" : "border-bark-brown-light/60 text-bark-brown hover:bg-parchment-dark"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {days.length === 0 && (
        <p className="text-sm text-iron-grey">{filter === "unseen" ? "Nothing new since your last look." : "No changes in this group yet."}</p>
      )}

      {days.map((day) => (
        <section key={day.date} aria-labelledby={`day-${day.date}`} className="space-y-3">
          <h2 id={`day-${day.date}`} className="font-display text-2xl text-gnome-green">{formatDay(day.date)}</h2>
          {day.entries.map((entry) => {
            const kind = KIND_STYLES[entry.kind];
            const fresh = isUnseen(entry);
            return (
              <article
                key={entry.id}
                className={`rounded-lg border bg-parchment/80 p-4 space-y-2 ${fresh ? "border-gnome-green shadow-md" : "border-bark-brown-light/40"}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${kind.className}`}>{kind.label}</span>
                  <span className="text-iron-grey">{AUDIENCE_LABELS[entry.audience]}</span>
                  {fresh && <span className="ml-auto rounded-full bg-red-accent px-2 py-0.5 font-semibold text-white">Not seen</span>}
                </div>
                <h3 className="font-semibold text-lg text-bark-brown leading-snug">{entry.title}</h3>
                <p className="text-bark-brown-light">{entry.summary}</p>
                {entry.tryIt && entry.tryIt.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-iron-grey mb-1">How to try it</p>
                    <ol className="list-decimal pl-5 text-sm text-bark-brown space-y-0.5">
                      {entry.tryIt.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {entry.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => markSeen([entry.id])}
                      className="rounded-md border border-gnome-green px-3 py-1.5 text-sm font-semibold text-gnome-green hover:bg-gnome-green hover:text-white transition-colors"
                    >
                      {link.label} →
                    </Link>
                  ))}
                  {entry.links.length > 0 && (
                    <button
                      type="button"
                      onClick={() => startWalkthrough(visible, visible.filter((e) => e.links.length > 0).indexOf(entry))}
                      className="text-sm text-iron-grey hover:text-gnome-green cursor-pointer"
                    >
                      Start walkthrough here
                    </button>
                  )}
                  {fresh && (
                    <button type="button" onClick={() => markSeen([entry.id])} className="ml-auto text-xs text-iron-grey hover:text-gnome-green cursor-pointer">
                      Mark as seen
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
