"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EVENT_TYPES } from "@/lib/constants";
import { BannerGenerator } from "@/components/admin/BannerGenerator";

interface EventForm {
  title: string;
  description: string;
  event_type: string;
  start_time: string;
  end_time: string;
  host_rsn: string;
  world: string;
  location: string;
  meet_location: string;
  spots: string;
  signup_type: string;
  voice_channel: string;
  requirements: string;
  requirements_list: string;
  guide_text: string;
  video_url: string;
  prize_pool: string;
  banner_url: string;
  post_to_discord: boolean;
  create_signup_thread: boolean;
}

const EMPTY_FORM: EventForm = {
  title: "",
  description: "",
  event_type: "pvm",
  start_time: "",
  end_time: "",
  host_rsn: "",
  world: "",
  location: "",
  meet_location: "",
  spots: "Open",
  signup_type: "Open — just show up",
  voice_channel: "",
  requirements: "",
  requirements_list: "",
  guide_text: "",
  video_url: "",
  prize_pool: "",
  banner_url: "",
  post_to_discord: true,
  create_signup_thread: false,
};

const SIGNUP_TYPES = [
  "Open — just show up",
  "DM Host",
  "React to sign up",
  "Application required",
];

const inputClass =
  "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green";
const labelClass = "block text-sm font-semibold text-bark-brown mb-1";

export default function AdminEventsPage() {
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof EventForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          world: form.world ? parseInt(form.world) : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const discordNote = form.post_to_discord
          ? " and posted to Discord"
          : "";
        const threadNote = data.signup_thread_created
          ? " + sign-up thread created"
          : "";
        setStatus({
          type: "success",
          message: `Event "${form.title}" created${discordNote}${threadNote}!`,
        });
        setForm(EMPTY_FORM);
      } else {
        setStatus({ type: "error", message: data.error ?? "Failed to create event." });
      }
    } catch {
      setStatus({ type: "error", message: "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  };

  // Build preview
  const preview = buildPreview(form);

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-6">Create Event</h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card hover={false}>
            <h2 className="font-display text-lg text-bark-brown mb-4">Event Details</h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Event Title *</label>
                <input type="text" value={form.title} onChange={(e) => update("title", e.target.value)} required className={inputClass} placeholder="Hueycotl Boss Event" />
              </div>

              <div>
                <label className={labelClass}>Description / Flavor Text</label>
                <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} className={`${inputClass} resize-y`} placeholder="Deep in the jungle ruins, an ancient serpent-spirit awaits..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Event Type</label>
                  <select value={form.event_type} onChange={(e) => update("event_type", e.target.value)} className={`${inputClass} cursor-pointer`}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Host RSN</label>
                  <input type="text" value={form.host_rsn} onChange={(e) => update("host_rsn", e.target.value)} className={`${inputClass} font-mono`} placeholder="Tmansim21" />
                </div>
              </div>
            </div>
          </Card>

          {/* Schedule */}
          <Card hover={false}>
            <h2 className="font-display text-lg text-bark-brown mb-4">Schedule</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Start Time *</label>
                <input type="datetime-local" value={form.start_time} onChange={(e) => update("start_time", e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>End Time</label>
                <input type="datetime-local" value={form.end_time} onChange={(e) => update("end_time", e.target.value)} className={inputClass} />
              </div>
            </div>
          </Card>

          {/* Logistics */}
          <Card hover={false}>
            <h2 className="font-display text-lg text-bark-brown mb-4">Logistics</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>World</label>
                  <input type="number" value={form.world} onChange={(e) => update("world", e.target.value)} className={inputClass} placeholder="404" />
                </div>
                <div>
                  <label className={labelClass}>Location</label>
                  <input type="text" value={form.location} onChange={(e) => update("location", e.target.value)} className={inputClass} placeholder="Jungle Ruins" />
                </div>
                <div>
                  <label className={labelClass}>Meet Location</label>
                  <input type="text" value={form.meet_location} onChange={(e) => update("meet_location", e.target.value)} className={inputClass} placeholder="GE" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Spots</label>
                  <input type="text" value={form.spots} onChange={(e) => update("spots", e.target.value)} className={inputClass} placeholder="Open" />
                </div>
                <div>
                  <label className={labelClass}>Signup Type</label>
                  <select value={form.signup_type} onChange={(e) => update("signup_type", e.target.value)} className={`${inputClass} cursor-pointer`}>
                    {SIGNUP_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Voice Channel</label>
                  <input type="text" value={form.voice_channel} onChange={(e) => update("voice_channel", e.target.value)} className={inputClass} placeholder="Event Room 1" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Prize Pool</label>
                <input type="text" value={form.prize_pool} onChange={(e) => update("prize_pool", e.target.value)} className={inputClass} placeholder="50M GP" />
              </div>
            </div>
          </Card>

          {/* Requirements & Guide */}
          <Card hover={false}>
            <h2 className="font-display text-lg text-bark-brown mb-4">Requirements & Guide</h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Short Requirements Summary</label>
                <input type="text" value={form.requirements} onChange={(e) => update("requirements", e.target.value)} className={inputClass} placeholder="70+ combat, bring own supplies" />
              </div>
              <div>
                <label className={labelClass}>Detailed Requirements (one per line)</label>
                <textarea value={form.requirements_list} onChange={(e) => update("requirements_list", e.target.value)} rows={5} className={`${inputClass} resize-y font-mono text-sm`} placeholder={"70+ Combat\nStrong Magic or Ranged setup\nDecent Prayer level\nAnti-poison or Venom protection\nFood, Prayer pots, and Teleports"} />
              </div>
              <div>
                <label className={labelClass}>Event-Specific Guide / Mechanics</label>
                <textarea value={form.guide_text} onChange={(e) => update("guide_text", e.target.value)} rows={6} className={`${inputClass} resize-y text-sm`} placeholder={"Phases & Attacks:\n• Serpent Strike: A fast melee hit — step back or pray melee.\n• Venom Spit: Ranged green projectile — bring anti-venom.\n\nSafe Spots & Movement:\n• Use the outer ring of the arena to avoid tail sweeps."} />
              </div>
              <div>
                <label className={labelClass}>Video Guide URL</label>
                <input type="url" value={form.video_url} onChange={(e) => update("video_url", e.target.value)} className={inputClass} placeholder="https://www.youtube.com/watch?v=..." />
              </div>
            </div>
          </Card>

          {/* Banner Generator */}
          <BannerGenerator
            title={form.title}
            description={form.description}
            eventType={form.event_type}
            type="event"
            currentBanner={form.banner_url || null}
            onBannerGenerated={(url) => update("banner_url", url)}
          />

          {/* Discord + Submit */}
          <Card hover={false}>
            <div className="flex items-start gap-3 mb-6">
              <button
                type="button"
                onClick={() => update("post_to_discord", !form.post_to_discord)}
                className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  form.post_to_discord
                    ? "bg-gnome-green border-gnome-green"
                    : "border-bark-brown-light hover:border-gnome-green"
                }`}
              >
                {form.post_to_discord && (
                  <svg className="w-4 h-4 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div>
                <p className="font-semibold text-bark-brown">Post to Discord</p>
                <p className="text-xs text-bark-brown-light">
                  Creates a Discord Scheduled Event and posts the formatted event
                  message to the events channel. Uncheck if the event already
                  exists in Discord.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 mb-6">
              <button
                type="button"
                onClick={() => update("create_signup_thread", !form.create_signup_thread)}
                className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  form.create_signup_thread
                    ? "bg-gnome-green border-gnome-green"
                    : "border-bark-brown-light hover:border-gnome-green"
                }`}
              >
                {form.create_signup_thread && (
                  <svg className="w-4 h-4 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div>
                <p className="font-semibold text-bark-brown">Create Sign-up Thread</p>
                <p className="text-xs text-bark-brown-light">
                  Creates a thread in #event-signups where members can react or
                  reply to sign up for this event.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={submitting} size="lg">
                {submitting ? "Creating..." : "Create Event"}
              </Button>
              {status && (
                <span className={`text-sm ${status.type === "error" ? "text-red-accent" : "text-gnome-green"}`}>
                  {status.message}
                </span>
              )}
            </div>
          </Card>
        </form>

        {/* Live Preview */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <h2 className="font-display text-lg text-bark-brown mb-4">Discord Preview</h2>
          <div className="bg-[#313338] text-[#dbdee1] font-sans text-sm leading-relaxed overflow-auto max-h-[80vh] rounded-lg border border-[#1e1f22] p-4 shadow-lg">
            <pre className="whitespace-pre-wrap break-words font-sans text-[13px]">
              {preview || <span className="text-[#72767d]">Fill in the form to see a preview...</span>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildPreview(form: EventForm): string {
  if (!form.title) return "";

  const lines: string[] = [];
  lines.push(`📢 @Event Pings ${form.title} 📢`);
  lines.push("");

  if (form.description) {
    lines.push(form.description);
    lines.push("");
  }

  lines.push(`⚔️ Event: ${form.title}`);
  if (form.host_rsn) lines.push(`🤠 Host: <@${form.host_rsn}>`);

  if (form.start_time) {
    const d = new Date(form.start_time);
    lines.push(`📅 Date: ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`);
    lines.push(`⏰ Time: ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} Eastern US`);
  }

  if (form.world) lines.push(`🌍 World: ${form.world}`);
  if (form.meet_location) lines.push(`📍 Meet: ${form.meet_location}`);
  if (form.spots) lines.push(`👥 Spots: ${form.spots}`);
  if (form.signup_type) lines.push(`📝 Signup: ${form.signup_type}`);
  if (form.voice_channel) lines.push(`🔊 Voice: ${form.voice_channel}`);
  if (form.prize_pool) lines.push(`🏆 Prize Pool: ${form.prize_pool}`);

  if (form.requirements_list) {
    lines.push("");
    lines.push("🎆 Recommended Requirements");
    const reqs = form.requirements_list.split("\n").map((r) => r.trim()).filter(Boolean);
    for (const req of reqs) {
      lines.push(`• ${req.replace(/^[•\-*]\s*/, "")}`);
    }
  }

  if (form.guide_text) {
    lines.push("");
    lines.push(`📄 Event-Specific Guide: ${form.title} Mechanics`);
    lines.push(form.guide_text);
  }

  if (form.video_url) {
    lines.push("");
    lines.push(`Video Guide: ${form.video_url}`);
  }

  return lines.join("\n");
}
