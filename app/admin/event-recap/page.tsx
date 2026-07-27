"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RolePingSelector } from "@/components/admin/RolePingSelector";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { TemplateSelector } from "@/components/admin/TemplateSelector";
import { EmojiPickerButton } from "@/components/admin/EmojiPickerButton";
import { PageTour } from "@/components/admin/tour/PageTour";
import { renderTemplate } from "@/lib/post-templates";
import type { SectionInstance } from "@/lib/post-templates";
import { usePermission } from "@/lib/use-permission";
import { EVENT_RECAP_TOUR } from "@/lib/tours";

interface PastEvent {
  id: string;
  title: string;
  event_type: string;
  start_time: string;
}

interface RecapPost {
  id: string;
  title: string;
  description: string | null;
  highlights: string[];
  winners: { rsn: string; prize: string }[];
  loot_items: string[];
  images: string[];
  ping_roles: string[];
  template_id: string | null;
  destination_channel_id: string;
  discord_message_id: string | null;
  event_id: string | null;
  created_at: string;
}

interface TrackedLootItem {
  name: string;
  unitPrice: number;
  qty: number;
}

export default function EventRecapPage() {
  const [events, setEvents] = useState<PastEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [destination, setDestination] = useState("");
  const [closeForumPost, setCloseForumPost] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState<string[]>([""]);
  const [winners, setWinners] = useState<{ rsn: string; prize: string }[]>([]);
  const [lootItems, setLootItems] = useState<string[]>([]);
  const [trackedLoot, setTrackedLoot] = useState<TrackedLootItem[]>([]);
  const [loadingTrackedLoot, setLoadingTrackedLoot] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [pingRoles, setPingRoles] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateSections, setTemplateSections] = useState<SectionInstance[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRecapId, setEditingRecapId] = useState<string | null>(null);
  const [pastRecaps, setPastRecaps] = useState<RecapPost[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  const { allowed: canSyncDiscord, loading: permLoading } = usePermission("sync_discord_posts");

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

  const loadPastRecaps = useCallback(async () => {
    const { data } = await supabase
      .from("event_recap_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setPastRecaps(data);
  }, [supabase]);

  useEffect(() => { loadEvents(); loadPastRecaps(); }, [loadEvents, loadPastRecaps]);

  // When selecting an event, prefill title
  useEffect(() => {
    if (selectedEvent) {
      const ev = events.find((e) => e.id === selectedEvent);
      if (ev) setTitle(ev.title);
    }
  }, [selectedEvent, events]);

  // When selecting an event, fetch any loot tracked for it via the Loot Split calculator
  useEffect(() => {
    if (!selectedEvent) {
      setTrackedLoot([]);
      return;
    }
    let cancelled = false;
    setLoadingTrackedLoot(true);
    fetch(`/api/events/${selectedEvent}/loot`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTrackedLoot(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setTrackedLoot([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTrackedLoot(false);
      });
    return () => { cancelled = true; };
  }, [selectedEvent]);

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

  const addLootItem = () => setLootItems([...lootItems, ""]);
  const removeLootItem = (i: number) => setLootItems(lootItems.filter((_, idx) => idx !== i));
  const updateLootItem = (i: number, val: string) => {
    const next = [...lootItems];
    next[i] = val;
    setLootItems(next);
  };

  const importTrackedLoot = () => {
    const lines = trackedLoot.map((item) => `${item.name} ×${item.qty} — ${(item.unitPrice * item.qty).toLocaleString()} gp`);
    setLootItems((prev) => [...prev.filter((l) => l.trim()), ...lines]);
  };

  const handleEditRecap = (recap: RecapPost) => {
    setEditingRecapId(recap.id);
    setSelectedEvent(recap.event_id ?? "");
    setTitle(recap.title);
    setDescription(recap.description ?? "");
    setHighlights(recap.highlights.length > 0 ? recap.highlights : [""]);
    setWinners(recap.winners ?? []);
    setLootItems(recap.loot_items ?? []);
    setImages(recap.images ?? []);
    setPingRoles(recap.ping_roles ?? []);
    setTemplateId(recap.template_id ?? "");
    setDestination(recap.destination_channel_id);
    setCloseForumPost(false);
    window.scrollTo(0, 0);
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
          lootItems: lootItems.filter((l) => l.trim()),
          images,
          author,
          pingRoles,
          eventId: selectedEvent || undefined,
          destination,
          templateId,
          dateStr,
          recapId: editingRecapId || undefined,
          closeForumPost,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        let message = data.edited ? "Recap updated on Discord!" : "Event recap posted to Discord!";
        if (closeForumPost) message += data.forum_closed ? " Forum post closed." : " (Couldn't close the forum post — it may not be a forum thread.)";
        setStatus(message);
        setTitle("");
        setDescription("");
        setHighlights([""]);
        setWinners([]);
        setLootItems([]);
        setImages([]);
        setPingRoles([]);
        setSelectedEvent("");
        setDestination("");
        setCloseForumPost(false);
        setEditingRecapId(null);
        await loadPastRecaps();
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
    lootItems: lootItems.filter((l) => l.trim()),
    author: "You",
    pingRoles,
    dateStr,
  });

  return (
    <div>
      <PageTour tour={EVENT_RECAP_TOUR} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-gnome-green">Post Event Recap</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-bark-brown-light hover:text-gnome-green transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={2} />
              <path strokeWidth={2} d="M15 4v16" fill={showPreview ? "currentColor" : "none"} />
            </svg>
            {showPreview ? "Hide Discord Preview" : "Show Discord Preview"}
          </button>
          <Link href="/admin/event-recap?tour=recap" className="text-sm text-gnome-green hover:underline">
            Take the Tour →
          </Link>
        </div>
      </div>

      <div className={showPreview ? "grid grid-cols-1 xl:grid-cols-2 gap-8" : ""}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Link to event */}
          <Card hover={false}>
            <h2 className="font-display text-lg text-bark-brown mb-4">Event</h2>
            <div className="space-y-4">
              <div data-tour="recap-link-event">
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
              <div data-tour="recap-destination">
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
              <label className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
                <input
                  type="checkbox"
                  checked={closeForumPost}
                  onChange={(e) => setCloseForumPost(e.target.checked)}
                  className="accent-gnome-green"
                />
                Close the forum post after posting this recap
              </label>
            </div>
          </Card>

          {/* Title & Description */}
          <Card hover={false}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="font-display text-lg text-bark-brown">Recap Details</h2>
              <div className="w-56 shrink-0" data-tour="recap-template">
                <TemplateSelector contentType="event_recap" value={templateId} onChange={setTemplateId} label="Choose Template" />
              </div>
            </div>
            <div className="space-y-4">
              <div data-tour="recap-title">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-bark-brown">Title *</label>
                  <EmojiPickerButton onInsert={(t) => setTitle((prev) => prev + (prev ? " " : "") + t)} />
                </div>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} placeholder="Hueycotl Boss Event Recap" />
              </div>
              <div data-tour="recap-description">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-bark-brown">Description</label>
                  <EmojiPickerButton onInsert={(t) => setDescription((prev) => prev + (prev ? " " : "") + t)} />
                </div>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputClass} resize-y`} placeholder="What a night! The clan gathered to take on Hueycotl and it was an absolute blast..." />
              </div>
            </div>
          </Card>

          {/* Highlights */}
          <div data-tour="recap-highlights">
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
                    <EmojiPickerButton onInsert={(t) => updateHighlight(i, h + (h ? " " : "") + t)} />
                    {highlights.length > 1 && (
                      <button type="button" onClick={() => removeHighlight(i)} className="text-red-accent hover:underline text-xs cursor-pointer shrink-0 px-2">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Winners */}
          <div data-tour="recap-winners">
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
          </div>

          {/* Loot */}
          <div>
            <Card hover={false}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg text-bark-brown">Loot (optional)</h2>
                <Button type="button" variant="ghost" size="sm" onClick={addLootItem}>+ Add</Button>
              </div>

              {selectedEvent && (
                <div className="mb-4 p-3 rounded-md bg-parchment-dark/40 border border-parchment-dark">
                  {loadingTrackedLoot ? (
                    <p className="text-xs text-iron-grey">Checking for tracked loot...</p>
                  ) : trackedLoot.length === 0 ? (
                    <p className="text-xs text-iron-grey">
                      No loot tracked for this event yet — save some from the{" "}
                      <Link href="/loot-split" className="text-gnome-green hover:underline" target="_blank">
                        Loot Split Calculator
                      </Link>.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-iron-grey uppercase tracking-wide mb-2">Tracked Loot for this Event</p>
                      <ul className="text-sm text-bark-brown space-y-0.5 mb-3">
                        {trackedLoot.map((item, i) => (
                          <li key={i}>
                            {item.name} ×{item.qty} — {(item.unitPrice * item.qty).toLocaleString()} gp
                          </li>
                        ))}
                      </ul>
                      <Button type="button" size="sm" variant="secondary" onClick={importTrackedLoot}>
                        Import into Recap
                      </Button>
                    </>
                  )}
                </div>
              )}

              {lootItems.length === 0 ? (
                <p className="text-xs text-iron-grey">No loot lines — click &quot;+ Add&quot; or import tracked loot above.</p>
              ) : (
                <div className="space-y-2">
                  {lootItems.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={l}
                        onChange={(e) => updateLootItem(i, e.target.value)}
                        className={`${inputClass} flex-1`}
                        placeholder="Rune Scimitar ×2 — 30,000 gp"
                      />
                      <button type="button" onClick={() => removeLootItem(i)} className="text-red-accent hover:underline text-xs cursor-pointer shrink-0 px-2">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Screenshots */}
          <div data-tour="recap-screenshots">
            <Card hover={false}>
              <ImageUploader images={images} onChange={setImages} maxImages={5} label="Event Screenshots" />
            </Card>
          </div>

          {/* Role Pings */}
          <div data-tour="recap-role-pings">
            <Card hover={false}>
              <RolePingSelector selectedRoles={pingRoles} onChange={setPingRoles} />
            </Card>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={submitting || !destination.trim()} size="lg" data-tour="recap-submit">
              {submitting ? "Posting..." : editingRecapId ? "Update Recap on Discord" : "Post Recap to Discord"}
            </Button>
            {editingRecapId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingRecapId(null);
                  setTitle(""); setDescription(""); setHighlights([""]); setWinners([]); setLootItems([]);
                  setImages([]); setPingRoles([]); setSelectedEvent(""); setDestination(""); setTemplateId("");
                  setCloseForumPost(false);
                }}
              >
                Cancel
              </Button>
            )}
            {status && (
              <span className={`text-sm ${status.startsWith("Error") ? "text-red-accent" : "text-gnome-green"}`}>
                {status}
              </span>
            )}
          </div>
        </form>

        {/* Live Preview */}
        {showPreview && (
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
        )}
      </div>

      {/* Past Recaps */}
      <div className="mt-10">
        <h2 className="font-display text-lg text-bark-brown mb-2">Past Recaps</h2>
        <p className="text-xs text-iron-grey mb-4">
          Recaps posted before this list existed aren&apos;t tracked here and can&apos;t be edited.
          {!permLoading && !canSyncDiscord && " You need the “Update Posted Discord Messages” permission to edit a past recap."}
        </p>
        {pastRecaps.length === 0 ? (
          <p className="text-sm text-iron-grey">No tracked recaps yet.</p>
        ) : (
          <div className="space-y-2">
            {pastRecaps.map((recap) => (
              <Card key={recap.id} hover={false}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-bark-brown truncate">{recap.title}</p>
                    <p className="text-xs text-iron-grey">{new Date(recap.created_at).toLocaleDateString()}</p>
                  </div>
                  {!permLoading && canSyncDiscord && (
                    <button
                      onClick={() => handleEditRecap(recap)}
                      className="text-xs text-gnome-green hover:underline cursor-pointer shrink-0"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
