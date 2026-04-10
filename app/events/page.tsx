import { EventCalendar } from "@/components/events/EventCalendar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events",
  description: "View upcoming and past Gn0me Home clan events.",
};

// Placeholder events until Supabase is connected
const PLACEHOLDER_EVENTS = [
  {
    id: "1",
    title: "Weekly PvM Bingo",
    start: new Date(Date.now() + 2 * 86400000).toISOString(),
    extendedProps: {
      eventType: "pvm",
      hostRsn: "Tmansim21",
      description: "Weekly PvM bingo event! Grab your gear and compete for prizes.",
    },
  },
  {
    id: "2",
    title: "Skill of the Week: Mining",
    start: new Date(Date.now() + 5 * 86400000).toISOString(),
    end: new Date(Date.now() + 12 * 86400000).toISOString(),
    extendedProps: {
      eventType: "skilling",
      description: "Compete for the most mining XP gained this week!",
    },
  },
  {
    id: "3",
    title: "Drop Party",
    start: new Date(Date.now() + 7 * 86400000).toISOString(),
    extendedProps: {
      eventType: "drop_party",
      hostRsn: "Tmansim21",
      world: 420,
      description: "Monthly drop party at the GE. 50M+ in prizes!",
    },
  },
];

export default function EventsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">
        Events Calendar
      </h1>
      <p className="text-bark-brown-light mb-8">
        Upcoming clan events, competitions, and social gatherings. Events sync
        with our Discord server.
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6">
        {[
          { label: "PvM", color: "#8B1A1A" },
          { label: "Skilling", color: "#2D5016" },
          { label: "Drop Party", color: "#DAA520" },
          { label: "Hide & Seek", color: "#4A7C23" },
          { label: "Social", color: "#3E2B1C" },
        ].map((type) => (
          <div key={type.label} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: type.color }}
            />
            <span className="text-bark-brown-light">{type.label}</span>
          </div>
        ))}
      </div>

      <EventCalendar events={PLACEHOLDER_EVENTS} />
    </div>
  );
}
