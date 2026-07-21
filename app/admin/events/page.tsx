"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EVENT_TYPES } from "@/lib/constants";
import { BannerGenerator } from "@/components/admin/BannerGenerator";
import { ReformatButton } from "@/components/admin/ReformatButton";
import { RolePingSelector } from "@/components/admin/RolePingSelector";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { TemplateSelector } from "@/components/admin/TemplateSelector";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { renderTemplate } from "@/lib/post-templates";
import type { SectionInstance } from "@/lib/post-templates";

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
  extra_images: string[];
  ping_roles: string[];
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
  extra_images: [],
  ping_roles: [],
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

function eventTemplateData(form: EventForm): Record<string, unknown> {
  const startDate = form.start_time ? new Date(form.start_time) : null;
  return {
    title: form.title,
    description: form.description,
    host_rsn: form.host_rsn,
    dateStr: startDate ? startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "",
    timeStr: startDate ? startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "",
    world: form.world,
    meet_location: form.meet_location,
    spots: form.spots,
    signup_type: form.signup_type,
    voice_channel: form.voice_channel,
    prize_pool: form.prize_pool,
    requirements: form.requirements,
    requirements_list: form.requirements_list,
    guide_text: form.guide_text,
    video_url: form.video_url,
    pingRoles: form.ping_roles,
  };
}

export default function AdminEventsPage() {
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [signupThreadTemplateId, setSignupThreadTemplateId] = useState("");
  const [templateSections, setTemplateSections] = useState<SectionInstance[]>([]);

  const update = (field: keyof EventForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!templateId) {
      setTemplateSections([]);
      return;
    }
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("post_templates")
        .select("sections")
        .eq("id", templateId)
        .single();
      setTemplateSections(data?.sections ?? []);
    })();
  }, [templateId]);

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
          templateId,
          signupThreadTemplateId,
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

  const preview = renderTemplate(templateSections, eventTemplateData(form));

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
                <div className="mt-2">
                  <ReformatButton
                    content={form.description}
                    title={form.title}
                    type="event"
                    onAccept={(reformatted) => update("description", reformatted)}
                  />
                </div>
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

          {/* Extra Images */}
          <Card hover={false}>
            <ImageUploader
              images={form.extra_images}
              onChange={(imgs) => setForm((prev) => ({ ...prev, extra_images: imgs }))}
              maxImages={4}
              label="Additional Event Images"
            />
          </Card>

          {/* Role Pings */}
          <Card hover={false}>
            <RolePingSelector
              selectedRoles={form.ping_roles}
              onChange={(roles) => setForm((prev) => ({ ...prev, ping_roles: roles }))}
            />
          </Card>

          {/* Discord + Submit */}
          <Card hover={false}>
            <div className="flex items-start gap-3 mb-4">
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
            {form.post_to_discord && (
              <div className="mb-6 ml-9">
                <TemplateSelector contentType="event_post" value={templateId} onChange={setTemplateId} label="Event Post Template" />
              </div>
            )}

            <div className="flex items-start gap-3 mb-4">
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
            {form.create_signup_thread && (
              <div className="mb-6 ml-9">
                <TemplateSelector contentType="signup_thread" value={signupThreadTemplateId} onChange={setSignupThreadTemplateId} label="Signup Thread Template" />
              </div>
            )}

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
