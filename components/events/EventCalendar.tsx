"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";

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
  other: "#6B6B6B",
};

export function EventCalendar({ events }: EventCalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const coloredEvents = events.map((e) => ({
    ...e,
    color: e.color ?? EVENT_TYPE_COLORS[e.extendedProps?.eventType ?? "other"] ?? "#6B6B6B",
  }));

  return (
    <div>
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
            const event = events.find((e) => e.id === info.event.id);
            if (event) setSelectedEvent(event);
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
          </div>
        </div>
      )}
    </div>
  );
}
