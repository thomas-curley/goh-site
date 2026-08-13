"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import { Button } from "@/components/ui/Button";
import { useIsStaff } from "@/lib/use-is-staff";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  color?: string;
  extendedProps?: {
    eventType: string;
    hostRsn?: string;
    world?: number;
    description?: string;
    location?: string;
    meetLocation?: string;
    spots?: string;
    signupType?: string;
    voiceChannel?: string;
    prizePool?: string;
    requirements?: string;
    requirementsList?: string;
    isCompetition?: boolean;
    metric?: string;
    competitionType?: string;
    womUrl?: string;
  };
}

interface EventCalendarProps {
  events: CalendarEvent[];
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

const FILTER_TYPES: { key: string; label: string; color: string }[] = [
  { key: "pvm", label: "PvM", color: "#8B1A1A" },
  { key: "skilling", label: "Skilling", color: "#2D5016" },
  { key: "drop_party", label: "Drop Party", color: "#DAA520" },
  { key: "hide_seek", label: "Hide & Seek", color: "#4A7C23" },
  { key: "social", label: "Social", color: "#3E2B1C" },
  { key: "competition", label: "Competitions", color: "#5D3A9E" },
];

export function EventCalendar({ events }: EventCalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const isStaff = useIsStaff();
  // Empty = nothing hidden = every type shown by default; clicking a legend
  // chip toggles that type out (or back in) rather than the other way
  // around, so filtering is something you opt into, not a default limit.
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  const toggleType = (key: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCopyCheckInLink = async (eventId: string) => {
    const url = `${window.location.origin}/events/${eventId}/signup`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const visibleEvents = events.filter(
    (e) => !hiddenTypes.has(e.extendedProps?.eventType ?? "other")
  );

  const coloredEvents = visibleEvents.map((e) => ({
    ...e,
    color: e.color ?? EVENT_TYPE_COLORS[e.extendedProps?.eventType ?? "other"] ?? "#6B6B6B",
  }));

  return (
    <div>
      {/* Legend / filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_TYPES.map((type) => {
          const active = !hiddenTypes.has(type.key);
          return (
            <button
              key={type.key}
              onClick={() => toggleType(type.key)}
              className={`flex items-center gap-2 text-sm px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                active
                  ? "border-transparent bg-parchment-dark text-bark-brown"
                  : "border-parchment-dark text-iron-grey opacity-50"
              }`}
              title={active ? `Hide ${type.label}` : `Show ${type.label}`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: type.color }}
              />
              {type.label}
            </button>
          );
        })}
      </div>

      <div className="fc-gnome">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,listWeek",
          }}
          events={coloredEvents}
          eventClick={(info) => {
            const event = visibleEvents.find((e) => e.id === info.event.id);
            if (event) {
              setSelectedEvent(event);
              setLinkCopied(false);
            }
          }}
          height="auto"
          eventDisplay="block"
        />
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="card-wood max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl text-gnome-green">
                {selectedEvent.title}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-iron-grey hover:text-bark-brown cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {selectedEvent.extendedProps?.isCompetition ? (
              <>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-iron-grey">Period: </span>
                    {new Date(selectedEvent.start).toLocaleDateString()}
                    {selectedEvent.end && ` — ${new Date(selectedEvent.end).toLocaleDateString()}`}
                  </p>
                  {selectedEvent.extendedProps.metric && (
                    <p>
                      <span className="text-iron-grey">Metric: </span>
                      <span className="capitalize">{selectedEvent.extendedProps.metric.replace(/_/g, " ")}</span>
                    </p>
                  )}
                  {selectedEvent.extendedProps.competitionType && (
                    <p>
                      <span className="text-iron-grey">Type: </span>
                      <span className="capitalize">{selectedEvent.extendedProps.competitionType}</span>
                    </p>
                  )}
                </div>
                {selectedEvent.extendedProps.womUrl && (
                  <a
                    href={selectedEvent.extendedProps.womUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-4"
                  >
                    <Button className="w-full">View on Wise Old Man</Button>
                  </a>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-iron-grey">When: </span>
                    {new Date(selectedEvent.start).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {selectedEvent.extendedProps?.hostRsn && (
                    <p>
                      <span className="text-iron-grey">Host: </span>
                      <span className="font-mono">{selectedEvent.extendedProps.hostRsn}</span>
                    </p>
                  )}
                  {selectedEvent.extendedProps?.world && (
                    <p>
                      <span className="text-iron-grey">World: </span>
                      {selectedEvent.extendedProps.world}
                    </p>
                  )}
                  {selectedEvent.extendedProps?.location && (
                    <p>
                      <span className="text-iron-grey">Location: </span>
                      {selectedEvent.extendedProps.location}
                    </p>
                  )}
                  {selectedEvent.extendedProps?.meetLocation && (
                    <p>
                      <span className="text-iron-grey">Meet: </span>
                      {selectedEvent.extendedProps.meetLocation}
                    </p>
                  )}
                  {selectedEvent.extendedProps?.spots && (
                    <p>
                      <span className="text-iron-grey">Spots: </span>
                      {selectedEvent.extendedProps.spots}
                    </p>
                  )}
                  {selectedEvent.extendedProps?.signupType && (
                    <p>
                      <span className="text-iron-grey">Signup: </span>
                      {selectedEvent.extendedProps.signupType}
                    </p>
                  )}
                  {selectedEvent.extendedProps?.voiceChannel && (
                    <p>
                      <span className="text-iron-grey">Voice: </span>
                      {selectedEvent.extendedProps.voiceChannel}
                    </p>
                  )}
                  {selectedEvent.extendedProps?.prizePool && (
                    <p>
                      <span className="text-iron-grey">Prize Pool: </span>
                      {selectedEvent.extendedProps.prizePool}
                    </p>
                  )}
                  {selectedEvent.extendedProps?.description && (
                    <p className="text-bark-brown-light mt-3">
                      {selectedEvent.extendedProps.description}
                    </p>
                  )}
                  {selectedEvent.extendedProps?.requirements && (
                    <p className="text-bark-brown-light mt-2">
                      <span className="text-iron-grey">Requirements: </span>
                      {selectedEvent.extendedProps.requirements}
                    </p>
                  )}
                </div>
                <a href={`/events/${selectedEvent.id}/signup`} className="block mt-4">
                  <Button className="w-full">Check In</Button>
                </a>
                {isStaff && (
                  <Button
                    variant="ghost"
                    className="w-full mt-2"
                    onClick={() => handleCopyCheckInLink(selectedEvent.id)}
                  >
                    {linkCopied ? "Copied!" : "Copy Check-In Link"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
