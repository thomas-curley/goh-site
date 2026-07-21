"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RolePingSelector } from "@/components/admin/RolePingSelector";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { TemplateSelector } from "@/components/admin/TemplateSelector";
import { renderTemplate } from "@/lib/post-templates";
import type { SectionInstance } from "@/lib/post-templates";

interface PastEvent {
  id: string;
  title: string;
  event_type: string;
  start_time: string;
}

export default function EventRecapPage() {
  const [events, setEvents] = useState<PastEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [destination, setDestination] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState<string[]>([""]);
  const [winners, setWinners] = useState<{ rsn: string; prize: string }[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [pingRoles, setPingRoles] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateSections, setTemplateSections] = useState<SectionInstance[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowserClient();

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, title, event_type, start_time")
      .lte("start_time", new Date().toISOString())
      .order("start_time", { ascending: false })
      .limit(20);
    if (data) setEvents(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // When selecting an event, prefill title
  useEffect(() => {
    if (selectedEvent) {
      const ev = events.find((e) => e.id === selectedEvent);
      if (ev) setTitle(ev.title);
    }
  }, [selectedEvent, events]);

  const selectedEventData = events.find((e) => e.id === selectedEvent);
  const dateStr = selectedEventData
    ? new Date(selectedEventData.start_time).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

  useEffect(() => {
    if (!templateId) {
      setTemplateSections([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("post_templates")
        .select("sections")
        .eq("id", templateId)
        .single();
      setTemplateSections(data?.sections ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const addHighlight = () => setHighlights([...highlights, ""]);
  const removeHighlight = (i: number) => setHighlights(highlights.filter((_, idx) => idx !== i));
  const updateHighlight = (i: number, val: string) => {
    const next = [...highlights];
    next[i] = val;
    setHighlights(next);
  };

  const addWinner = () => setWinners([...winners, { rsn: "", prize: "" }]);
  const removeWinner = (i: number) => setWinners(winners.filter((_, idx) => idx !== i));
  const updateWinner = (i: number, field: "rsn" | "prize", val: string) => {
    const next = [...winners];
    next[i] = { ...next[i], [field]: val };
    setWinners(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destination.trim()) return;

    setSubmitting(true);
    setStatus(null);

    // Get author RSN
    const { data: { user } } = await supabase.auth.getUser();
    let author = "Admin";
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("rsn, discord_username")
        .eq("id", user.id)
        .single();
      author = profile?.rsn ?? profile?.discord_username ?? "Admin";
    }

    try {
      const res = await fetch("/api/events/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          highlights: highlights.filter((h) => h.trim()),
          winners: winners.filter((w) => w.rsn.trim()),
          images,
          author,
          pingRoles,
          eventId: selectedEvent || undefined,
          destination,
          templateId,
          dateStr,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("Event recap posted to Discord!");
        setTitle("");
        setDescription("");
        setHighlights([""]);
        setWinners([]);
        setImages([]);
        setPingRoles([]);
        setSelectedEvent("");
        setDestination("");
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch {
      setStatus("Failed to post recap.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green";
  const labelClass = "block text-sm font-semibold text-bark-brown mb-1";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  const previewLines = renderTemplate(templateSections, {
    title,
    description,
    highlights: highlights.filter((h) => h.trim()),
    winners: winners.filter((w) => w.rsn.trim()),
    author: "You",
    pingRoles,
    dateStr,
  });

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-6">Post Event Recap</h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Link to event */}
          <Card hover={false}>
            <h2 className="font-display text-lg text-bark-brown mb-4">Event</h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Link to Past Event (optional)</label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">— None (custom recap) —</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} — {new Date(ev.start_time).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Post To (forum post link or ID) *</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className={`${inputClass} font-mono text-sm`}
                  placeholder="https://discord.com/channels/.../.../... or a channel/thread ID"
                />
                <p className="text-xs text-iron-grey mt-1">
                  Open the event&apos;s forum post in Discord, right-click any message in it (or the post
                  itself) → <span className="font-semibold">Copy Message Link</span>, and paste it here.
                </p>
              </div>
            </div>
          </Card>

          {/* Title & Description */}
          <Card hover={false}>
            <h2 className="font-display text-lg text-bark-brown mb-4">Recap Details</h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Title *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} placeholder="Hueycotl Boss Event Recap" />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputClass} resize-y`} placeholder="What a night! The clan gathered to take on Hueycotl and it was an absolute blast..." />
              </div>
            </div>
          </Card>

          {/* Highlights */}
          <Card hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-bark-brown">Highlights</h2>
              <Button type="button" variant="ghost" size="sm" onClick={addHighlight}>+ Add</Button>
            </div>
            <div className="space-y-2">
              {highlights.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={h}
                    onChange={(e) => updateHighlight(i, e.target.value)}
                    className={`${inputClass} flex-1`}
                    placeholder="Pizza Queen tanked the boss for 15 minutes straight"
                  />
                  {highlights.length > 1 && (
                    <button type="button" onClick={() => removeHighlight(i)} className="text-red-accent hover:underline text-xs cursor-pointer shrink-0 px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Winners */}
          <Card hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-bark-brown">Winners (optional)</h2>
              <Button type="button" variant="ghost" size="sm" onClick={addWinner}>+ Add Winner</Button>
            </div>
            {winners.length === 0 ? (
              <p className="text-xs text-iron-grey">No winners — click &quot;+ Add Winner&quot; if this was a competitive event.</p>
            ) : (
              <div className="space-y-2">
                {winners.map((w, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={w.rsn}
                      onChange={(e) => updateWinner(i, "rsn", e.target.value)}
                      className={`${inputClass} flex-1 font-mono`}
                      placeholder="RSN"
                    />
                    <input
                      type="text"
                      value={w.prize}
                      onChange={(e) => updateWinner(i, "prize", e.target.value)}
                      className={`${inputClass} flex-1`}
                      placeholder="Prize (e.g. 10M GP)"
                    />
                    <button type="button" onClick={() => removeWinner(i)} className="text-red-accent hover:underline text-xs cursor-pointer shrink-0 px-2">✕</button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Screenshots */}
          <Card hover={false}>
            <ImageUploader images={images} onChange={setImages} maxImages={5} label="Event Screenshots" />
          </Card>

          {/* Template */}
          <Card hover={false}>
            <TemplateSelector contentType="event_recap" value={templateId} onChange={setTemplateId} />
          </Card>

          {/* Role Pings */}
          <Card hover={false}>
            <RolePingSelector selectedRoles={pingRoles} onChange={setPingRoles} />
          </Card>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={submitting || !destination.trim()} size="lg">
              {submitting ? "Posting..." : "Post Recap to Discord"}
            </Button>
            {status && (
              <span className={`text-sm ${status.startsWith("Error") ? "text-red-accent" : "text-gnome-green"}`}>
                {status}
              </span>
            )}
          </div>
        </form>

        {/* Live Preview */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <h2 className="font-display text-lg text-bark-brown mb-4">Discord Preview</h2>
          <div className="bg-[#313338] text-[#dbdee1] font-sans text-sm leading-relaxed overflow-auto max-h-[80vh] rounded-lg border border-[#1e1f22] p-4 shadow-lg">
            <pre className="whitespace-pre-wrap break-words font-sans text-[13px]">
              {previewLines || <span className="text-[#72767d]">Fill in the form to see a preview...</span>}
            </pre>
            {images.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {images.map((url, i) => (
                  <img key={i} src={url} alt={`Preview ${i + 1}`} className="rounded max-h-32 w-auto shrink-0" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
