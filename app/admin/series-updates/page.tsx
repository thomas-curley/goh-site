"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RolePingSelector } from "@/components/admin/RolePingSelector";
import { TemplateSelector } from "@/components/admin/TemplateSelector";
import { ChannelSelector } from "@/components/admin/ChannelSelector";
import { EmojiPickerButton } from "@/components/admin/EmojiPickerButton";
import { TextFormatToolbar } from "@/components/admin/TextFormatToolbar";
import { renderTemplate } from "@/lib/post-templates";
import type { SectionInstance } from "@/lib/post-templates";
import { usePermission } from "@/lib/use-permission";

interface SeriesOption {
  discordEventId: string;
  title: string;
  occurrences: number;
}

interface SeriesUpdatePost {
  id: string;
  discord_event_id: string | null;
  series_title: string;
  description: string;
  ping_roles: string[];
  template_id: string | null;
  destination_channel_id: string;
  discord_message_id: string | null;
  created_at: string;
}

export default function SeriesUpdatesPage() {
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string>("");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [description, setDescription] = useState("");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [pingRoles, setPingRoles] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateSections, setTemplateSections] = useState<SectionInstance[]>([]);
  const [signAsAuthor, setSignAsAuthor] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [pastPosts, setPastPosts] = useState<SeriesUpdatePost[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  const { allowed: canSyncDiscord, loading: permLoading } = usePermission("sync_discord_posts");

  const supabase = createSupabaseBrowserClient();

  const loadSeries = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("discord_event_id, title, start_time")
      .not("discord_event_id", "is", null)
      .order("start_time", { ascending: false })
      .limit(300);

    const byId = new Map<string, SeriesOption>();
    for (const row of data ?? []) {
      if (!row.discord_event_id) continue;
      const existing = byId.get(row.discord_event_id);
      if (existing) {
        existing.occurrences += 1;
      } else {
        byId.set(row.discord_event_id, { discordEventId: row.discord_event_id, title: row.title, occurrences: 1 });
      }
    }
    setSeries(Array.from(byId.values()));
    setLoading(false);
  }, [supabase]);

  const loadPastPosts = useCallback(async () => {
    const { data } = await supabase
      .from("series_update_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setPastPosts(data);
  }, [supabase]);

  useEffect(() => { loadSeries(); loadPastPosts(); }, [loadSeries, loadPastPosts]);

  // When picking a known series, prefill the title (still editable).
  useEffect(() => {
    if (selectedSeries) {
      const s = series.find((s) => s.discordEventId === selectedSeries);
      if (s) setSeriesTitle(s.title);
    }
  }, [selectedSeries, series]);

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

  const handleEditPost = (post: SeriesUpdatePost) => {
    setEditingPostId(post.id);
    setSelectedSeries(post.discord_event_id ?? "");
    setSeriesTitle(post.series_title);
    setDescription(post.description);
    setPingRoles(post.ping_roles ?? []);
    setTemplateId(post.template_id ?? "");
    setDestination(post.destination_channel_id);
    setSignAsAuthor(false);
    window.scrollTo(0, 0);
  };

  const resetForm = () => {
    setSelectedSeries("");
    setSeriesTitle("");
    setDescription("");
    setPingRoles([]);
    setDestination("");
    setEditingPostId(null);
    setSignAsAuthor(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seriesTitle.trim() || !description.trim() || !destination.trim()) return;

    setSubmitting(true);
    setStatus(null);

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
      const res = await fetch("/api/events/series-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesTitle,
          discordEventId: selectedSeries || undefined,
          description,
          author,
          signAsAuthor,
          pingRoles,
          destination,
          templateId,
          postId: editingPostId || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus(data.edited ? "Update edited on Discord!" : "Series update posted to Discord!");
        resetForm();
        await loadPastPosts();
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch {
      setStatus("Failed to post series update.");
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
    series_title: seriesTitle,
    description,
    author: signAsAuthor ? "You" : undefined,
    pingRoles,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gnome-green">Series Update</h1>
          <p className="text-sm text-bark-brown-light mt-1">
            Post what tonight&apos;s activity is for a recurring series night — no new event record needed.
          </p>
        </div>
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
      </div>

      <div className={showPreview ? "grid grid-cols-1 xl:grid-cols-2 gap-8" : ""}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card hover={false}>
            <h2 className="font-display text-lg text-bark-brown mb-4">Series</h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Which series is this for?</label>
                <select
                  value={selectedSeries}
                  onChange={(e) => setSelectedSeries(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">— Custom / not in the list —</option>
                  {series.map((s) => (
                    <option key={s.discordEventId} value={s.discordEventId}>
                      {s.title} ({s.occurrences} past occurrences)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Series Title *</label>
                <input
                  type="text"
                  value={seriesTitle}
                  onChange={(e) => setSeriesTitle(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="PVM Thursday"
                />
              </div>
              <div className="space-y-2">
                <ChannelSelector value={destination} onChange={setDestination} label="Post To *" />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className={`${inputClass} font-mono text-xs`}
                  placeholder="Or paste a channel/message link or ID manually"
                />
              </div>
            </div>
          </Card>

          <Card hover={false}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="font-display text-lg text-bark-brown">Tonight&apos;s Plan</h2>
              <div className="w-56 shrink-0">
                <TemplateSelector contentType="series_update" value={templateId} onChange={setTemplateId} label="Choose Template" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-bark-brown">What are we doing? *</label>
                <div className="flex items-center gap-1">
                  <TextFormatToolbar value={description} onChange={setDescription} targetRef={descriptionRef} />
                  <EmojiPickerButton onInsert={(t) => setDescription((prev) => prev + (prev ? " " : "") + t)} />
                </div>
              </div>
              <textarea
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                className={`${inputClass} resize-y`}
                placeholder="Tonight we're farming Vorkath — meet at GE 8pm, bring anti-dragon fire shield"
              />
            </div>
          </Card>

          <Card hover={false}>
            <RolePingSelector selectedRoles={pingRoles} onChange={setPingRoles} />
          </Card>

          <label className="flex items-center gap-2 text-sm text-bark-brown-light cursor-pointer">
            <input type="checkbox" checked={signAsAuthor} onChange={(e) => setSignAsAuthor(e.target.checked)} className="accent-gnome-green" />
            Sign the Discord post with my name
          </label>

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={submitting || !destination.trim()} size="lg">
              {submitting ? "Posting..." : editingPostId ? "Update on Discord" : "Post to Discord"}
            </Button>
            {editingPostId && (
              <Button type="button" variant="ghost" onClick={resetForm}>
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

        {showPreview && (
          <div className="xl:sticky xl:top-20 xl:self-start">
            <h2 className="font-display text-lg text-bark-brown mb-4">Discord Preview</h2>
            <div className="bg-[#313338] text-[#dbdee1] font-sans text-sm leading-relaxed overflow-auto max-h-[80vh] rounded-lg border border-[#1e1f22] p-4 shadow-lg">
              <pre className="whitespace-pre-wrap break-words font-sans text-[13px]">
                {previewLines || <span className="text-[#72767d]">Fill in the form to see a preview...</span>}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg text-bark-brown mb-2">Past Series Updates</h2>
        <p className="text-xs text-iron-grey mb-4">
          {!permLoading && !canSyncDiscord && "You need the “Update Posted Discord Messages” permission to edit a past update."}
        </p>
        {pastPosts.length === 0 ? (
          <p className="text-sm text-iron-grey">No series updates posted yet.</p>
        ) : (
          <div className="space-y-2">
            {pastPosts.map((post) => (
              <Card key={post.id} hover={false}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-bark-brown truncate">{post.series_title}</p>
                    <p className="text-xs text-iron-grey truncate">{post.description}</p>
                    <p className="text-xs text-iron-grey">{new Date(post.created_at).toLocaleDateString()}</p>
                  </div>
                  {!permLoading && canSyncDiscord && (
                    <button
                      onClick={() => handleEditPost(post)}
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
