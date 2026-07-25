import { EventCalendar } from "@/components/events/EventCalendar";
import { createClient } from "@supabase/supabase-js";
import { getGroupCompetitions } from "@/lib/wom";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events",
  description: "View upcoming and past Gn0me Home clan events.",
};

export const dynamic = "force-dynamic";

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
  competition: "#5D3A9E",
  other: "#6B6B6B",
};

export default async function EventsPage() {
  const [events, competitions] = await Promise.all([getEvents(), getGroupCompetitions()]);

  const eventEntries = events.map((e) => ({
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

  // Every WOM competition (active, upcoming, and past) so the calendar
  // reflects a full month of clan activity, not just what's happening now.
  const competitionEntries = competitions.map((c) => ({
    id: `comp-${c.id}`,
    title: `🏆 ${c.title}`,
    start: new Date(c.startsAt).toISOString(),
    end: new Date(c.endsAt).toISOString(),
    color: EVENT_TYPE_COLORS.competition,
    extendedProps: {
      eventType: "competition",
      isCompetition: true,
      metric: c.metric,
      competitionType: c.type,
      womUrl: `https://wiseoldman.net/competitions/${c.id}`,
    },
  }));

  const calendarEvents = [...eventEntries, ...competitionEntries];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">
        Events Calendar
      </h1>
      <p className="text-bark-brown-light mb-8">
        Upcoming clan events, competitions, and social gatherings. Events sync
        with our Discord server; competitions are pulled from Wise Old Man.
      </p>

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
