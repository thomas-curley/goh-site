"use client";

import { Card } from "@/components/ui/Card";
import { EVENT_TYPES, CLAN_TIMEZONE } from "@/lib/constants";
import { BannerGenerator } from "@/components/admin/BannerGenerator";
import { ReformatButton } from "@/components/admin/ReformatButton";
import { RolePingSelector } from "@/components/admin/RolePingSelector";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { EmojiPickerButton } from "@/components/admin/EmojiPickerButton";

export interface EventForm {
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

export const EMPTY_FORM: EventForm = {
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

export const SIGNUP_TYPES = [
  "Open — just show up",
  "DM Host",
  "React to sign up",
  "Application required",
];

export const inputClass =
  "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green";
export const labelClass = "block text-sm font-semibold text-bark-brown mb-1";

/** Builds the data object the event_post/event_recap template renderer expects from form state. */
export function eventTemplateData(form: EventForm): Record<string, unknown> {
  const startDate = form.start_time ? new Date(form.start_time) : null;
  return {
    title: form.title,
    description: form.description,
    host_rsn: form.host_rsn,
    dateStr: startDate ? startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: CLAN_TIMEZONE }) : "",
    timeStr: startDate ? startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: CLAN_TIMEZONE }) : "",
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

interface EventFormFieldsProps {
  form: EventForm;
  update: (field: keyof EventForm, value: string | boolean) => void;
  setForm: React.Dispatch<React.SetStateAction<EventForm>>;
  /**
   * Data-object keys the currently selected post template actually
   * references (see lib/post-templates.ts's getUsedFields) — when provided,
   * fields the template doesn't use are hidden so the form matches what
   * will actually get posted. `null`/undefined shows every field, which is
   * what the edit page always passes (it doesn't do this narrowing).
   *
   * Note: several of these fields (World, Meet Location, Spots,
   * Requirements, ...) are also shown on the public events calendar, not
   * just in the Discord message — hiding one because the chosen template
   * skips it also means that data won't get entered for the calendar.
   */
  visibleFields?: Set<string> | null;
}

/**
 * The event content fields shared between the create page and the edit
 * page — everything except the Discord posting/sync options, which differ
 * enough between create and edit that each page owns its own card.
 */
export function EventFormFields({ form, update, setForm, visibleFields = null }: EventFormFieldsProps) {
  const shows = (key: string) => !visibleFields || visibleFields.has(key);

  const anyLogisticsRow2 = shows("spots") || shows("signup_type") || shows("voice_channel");
  const anyRequirements = shows("requirements") || shows("requirements_list") || shows("guide_text") || shows("video_url");

  return (
    <>
      {/* Basic Info */}
      <Card hover={false}>
        <h2 className="font-display text-lg text-bark-brown mb-4">Event Details</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-bark-brown">Event Title *</label>
              <EmojiPickerButton onInsert={(t) => update("title", form.title + (form.title ? " " : "") + t)} />
            </div>
            <input type="text" value={form.title} onChange={(e) => update("title", e.target.value)} required className={inputClass} placeholder="Hueycotl Boss Event" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-bark-brown">Description / Flavor Text</label>
              <EmojiPickerButton onInsert={(t) => update("description", form.description + (form.description ? " " : "") + t)} />
            </div>
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
            {shows("world") && (
              <div>
                <label className={labelClass}>World</label>
                <input type="number" value={form.world} onChange={(e) => update("world", e.target.value)} className={inputClass} placeholder="404" />
              </div>
            )}
            <div>
              <label className={labelClass}>Location</label>
              <input type="text" value={form.location} onChange={(e) => update("location", e.target.value)} className={inputClass} placeholder="Jungle Ruins" />
            </div>
            {shows("meet_location") && (
              <div>
                <label className={labelClass}>Meet Location</label>
                <input type="text" value={form.meet_location} onChange={(e) => update("meet_location", e.target.value)} className={inputClass} placeholder="GE" />
              </div>
            )}
          </div>

          {anyLogisticsRow2 && (
            <div className="grid grid-cols-3 gap-4">
              {shows("spots") && (
                <div>
                  <label className={labelClass}>Spots</label>
                  <input type="text" value={form.spots} onChange={(e) => update("spots", e.target.value)} className={inputClass} placeholder="Open" />
                </div>
              )}
              {shows("signup_type") && (
                <div>
                  <label className={labelClass}>Signup Type</label>
                  <select value={form.signup_type} onChange={(e) => update("signup_type", e.target.value)} className={`${inputClass} cursor-pointer`}>
                    {SIGNUP_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
              {shows("voice_channel") && (
                <div>
                  <label className={labelClass}>Voice Channel</label>
                  <input type="text" value={form.voice_channel} onChange={(e) => update("voice_channel", e.target.value)} className={inputClass} placeholder="Event Room 1" />
                </div>
              )}
            </div>
          )}

          {shows("prize_pool") && (
            <div>
              <label className={labelClass}>Prize Pool</label>
              <input type="text" value={form.prize_pool} onChange={(e) => update("prize_pool", e.target.value)} className={inputClass} placeholder="50M GP" />
            </div>
          )}
        </div>
      </Card>

      {/* Requirements & Guide */}
      {anyRequirements && (
        <Card hover={false}>
          <h2 className="font-display text-lg text-bark-brown mb-4">Requirements & Guide</h2>
          <div className="space-y-4">
            {shows("requirements") && (
              <div>
                <label className={labelClass}>Short Requirements Summary</label>
                <input type="text" value={form.requirements} onChange={(e) => update("requirements", e.target.value)} className={inputClass} placeholder="70+ combat, bring own supplies" />
              </div>
            )}
            {shows("requirements_list") && (
              <div>
                <label className={labelClass}>Detailed Requirements (one per line)</label>
                <textarea value={form.requirements_list} onChange={(e) => update("requirements_list", e.target.value)} rows={5} className={`${inputClass} resize-y font-mono text-sm`} placeholder={"70+ Combat\nStrong Magic or Ranged setup\nDecent Prayer level\nAnti-poison or Venom protection\nFood, Prayer pots, and Teleports"} />
              </div>
            )}
            {shows("guide_text") && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-bark-brown">Event-Specific Guide / Mechanics</label>
                  <EmojiPickerButton onInsert={(t) => update("guide_text", form.guide_text + (form.guide_text ? " " : "") + t)} />
                </div>
                <textarea value={form.guide_text} onChange={(e) => update("guide_text", e.target.value)} rows={6} className={`${inputClass} resize-y text-sm`} placeholder={"Phases & Attacks:\n• Serpent Strike: A fast melee hit — step back or pray melee.\n• Venom Spit: Ranged green projectile — bring anti-venom.\n\nSafe Spots & Movement:\n• Use the outer ring of the arena to avoid tail sweeps."} />
              </div>
            )}
            {shows("video_url") && (
              <div>
                <label className={labelClass}>Video Guide URL</label>
                <input type="url" value={form.video_url} onChange={(e) => update("video_url", e.target.value)} className={inputClass} placeholder="https://www.youtube.com/watch?v=..." />
              </div>
            )}
          </div>
        </Card>
      )}

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
      {shows("pingRoles") && (
        <Card hover={false}>
          <RolePingSelector
            selectedRoles={form.ping_roles}
            onChange={(roles) => setForm((prev) => ({ ...prev, ping_roles: roles }))}
          />
        </Card>
      )}
    </>
  );
}
