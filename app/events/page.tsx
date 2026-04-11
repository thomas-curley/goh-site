import { EventCalendar } from "@/components/events/EventCalendar";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events",
  description: "View upcoming and past Gn0me Home clan events.",
};

export const revalidate = 300; // Revalidate every 5 minutes

async function getEvents() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return [];

  const supabase = createClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("start_time", { ascending: true });

  if (error || !data) return [];

  return data;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  pvm: "#8B1A1A",
  skilling: "#2D5016",
  drop_party: "#DAA520",
  hide_seek: "#4A7C23",
  social: "#3E2B1C",
  other: "#6B6B6B",
};

export default async function EventsPage() {
  const events = await getEvents();

  const calendarEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start_time,
    end: e.end_time ?? undefined,
    color: EVENT_TYPE_COLORS[e.event_type] ?? "#6B6B6B",
    extendedProps: {
      eventType: e.event_type,
      hostRsn: e.host_rsn,
      world: e.world,
      description: e.description,
      location: e.location,
      meetLocation: e.meet_location,
      spots: e.spots,
      signupType: e.signup_type,
      voiceChannel: e.voice_channel,
      prizePool: e.prize_pool,
      requirements: e.requirements,
      requirementsList: e.requirements_list,
    },
  }));

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

      {calendarEvents.length > 0 ? (
        <EventCalendar events={calendarEvents} />
      ) : (
        <div className="text-center py-16 text-iron-grey">
          <p className="font-display text-xl mb-2">No events yet</p>
          <p className="text-sm">Check back soon or join our Discord for event announcements.</p>
        </div>
      )}
    </div>
  );
}
