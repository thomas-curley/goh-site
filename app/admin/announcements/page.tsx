"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerGenerator } from "@/components/admin/BannerGenerator";
import { ReformatButton } from "@/components/admin/ReformatButton";
import { RolePingSelector } from "@/components/admin/RolePingSelector";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { TemplateSelector } from "@/components/admin/TemplateSelector";
import { EmojiPickerButton } from "@/components/admin/EmojiPickerButton";
import { TextFormatToolbar } from "@/components/admin/TextFormatToolbar";
import { PageTour } from "@/components/admin/tour/PageTour";
import { usePermission } from "@/lib/use-permission";
import { ANNOUNCEMENT_TOUR } from "@/lib/tours";
import { renderTemplate } from "@/lib/post-templates";
import type { SectionInstance } from "@/lib/post-templates";

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  published: boolean;
  banner_url: string | null;
  author_name: string | null;
  discord_message_id: string | null;
  created_at: string;
}

const CATEGORIES = [
  { key: "announcement", label: "Announcement" },
  { key: "update", label: "Update" },
  { key: "event_recap", label: "Event Recap" },
  { key: "patch_notes", label: "Patch Notes" },
  { key: "community", label: "Community" },
];

const inputClass =
  "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [category, setCategory] = useState("announcement");
  const [pinned, setPinned] = useState(false);
  const [bannerUrl, setBannerUrl] = useState("");
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [postToDiscord, setPostToDiscord] = useState(true);
  const [pingRoles, setPingRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDiscordMessageId, setEditingDiscordMessageId] = useState<string | null>(null);
  const [syncDiscord, setSyncDiscord] = useState(true);
  const [signAsAuthor, setSignAsAuthor] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [templateSections, setTemplateSections] = useState<SectionInstance[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  const { allowed: canSyncDiscord, loading: permLoading } = usePermission("sync_discord_posts");

  const supabase = createSupabaseBrowserClient();

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

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (data) setAnnouncements(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setStatus(null);

    const { data: { user } } = await supabase.auth.getUser();

    // Get linked RSN for author name (fall back to Discord name)
    let authorName = user?.user_metadata?.full_name ?? "Admin";
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("rsn, discord_username")
        .eq("id", user.id)
        .single();
      if (profile?.rsn) {
        authorName = profile.rsn;
      } else if (profile?.discord_username) {
        authorName = profile.discord_username;
      }
    }

    if (editingId) {
      const { error } = await supabase
        .from("announcements")
        .update({ title, content, category, pinned, banner_url: bannerUrl || null, author_name: authorName, updated_at: new Date().toISOString() })
        .eq("id", editingId);
      if (error) { setStatus(`Error: ${error.message}`); setSaving(false); return; }

      if (editingDiscordMessageId && syncDiscord && canSyncDiscord) {
        try {
          const res = await fetch(`/api/announcements/${editingId}/sync-discord`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: extraImages, pingRoles, templateId, signAsAuthor }),
          });
          const data = await res.json();
          setStatus(res.ok ? "Announcement updated and Discord message synced!" : `Announcement updated, but Discord sync failed: ${data.error}`);
        } catch {
          setStatus("Announcement updated! (Discord sync failed)");
        }
      } else {
        setStatus("Announcement updated!");
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("announcements")
        .insert({
          title, content, category, pinned,
          banner_url: bannerUrl || null,
          author_id: user?.id,
          author_name: authorName,
        })
        .select()
        .single();
      if (error || !inserted) { setStatus(`Error: ${error?.message ?? "Failed to save"}`); setSaving(false); return; }

      // Post to Discord if checked
      if (postToDiscord) {
        try {
          const res = await fetch(`/api/announcements/${inserted.id}/sync-discord`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: extraImages, pingRoles, templateId, signAsAuthor }),
          });
          const data = await res.json().catch(() => ({}));
          setStatus(res.ok ? "Announcement published and posted to Discord!" : `Announcement published, but Discord post failed: ${data.error ?? "unknown error"}`);
        } catch {
          setStatus("Announcement published! (Discord post failed)");
        }
      } else {
        setStatus("Announcement published!");
      }
    }

    setTitle("");
    setContent("");
    setCategory("announcement");
    setPinned(false);
    setBannerUrl("");
    setPostToDiscord(true);
    setPingRoles([]);
    setExtraImages([]);
    setEditingId(null);
    setEditingDiscordMessageId(null);
    setSyncDiscord(true);
    setSignAsAuthor(false);
    setSaving(false);
    await load();
  };

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id);
    setEditingDiscordMessageId(a.discord_message_id);
    setTitle(a.title);
    setContent(a.content);
    setCategory(a.category);
    setPinned(a.pinned);
    setBannerUrl(a.banner_url ?? "");
    window.scrollTo(0, 0);
  };

  const handleTogglePublish = async (a: Announcement) => {
    await supabase
      .from("announcements")
      .update({ published: !a.published, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    await load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    setStatus("Announcement deleted.");
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  const previewLines = renderTemplate(templateSections, {
    title,
    content,
    author: signAsAuthor ? "You" : undefined,
    pingRoles,
  });
  const previewImages = [bannerUrl, ...extraImages].filter(Boolean);

  return (
    <div>
      <PageTour tour={ANNOUNCEMENT_TOUR} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-gnome-green">Announcements</h1>
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
          <Link href="/admin/announcements?tour=announcement" className="text-sm text-gnome-green hover:underline">
            Take the Tour →
          </Link>
        </div>
      </div>

      {/* Import from Discord */}
      <Card hover={false} className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base text-bark-brown">Import from Discord</h3>
          <p className="text-xs text-bark-brown-light">
            Pull recent announcements from the #announcements channel that aren&apos;t already on the site.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setStatus(null);
            try {
              const res = await fetch("/api/announcements/import-discord", { method: "POST" });
              const data = await res.json();
              setStatus(data.message ?? data.error ?? "Done");
              await load();
            } catch {
              setStatus("Failed to import from Discord.");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Importing..." : "Import from Discord"}
        </Button>
      </Card>

      {status && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {status}
        </div>
      )}

      <div className={showPreview ? "grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8" : "mb-8"}>
      {/* Create / Edit Form */}
      <Card hover={false}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="font-display text-lg text-bark-brown">
            {editingId ? "Edit Announcement" : "New Announcement"}
          </h2>
          <div className="w-56 shrink-0" data-tour="announcement-template">
            <TemplateSelector contentType="announcement" value={templateId} onChange={setTemplateId} label="Choose Template" />
          </div>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div data-tour="announcement-title">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-bark-brown">Title</label>
              <EmojiPickerButton onInsert={(t) => setTitle((prev) => prev + (prev ? " " : "") + t)} />
            </div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} placeholder="Weekly Update" />
          </div>
          <div data-tour="announcement-content">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-bark-brown">Content</label>
              <div className="flex items-center gap-1">
                <TextFormatToolbar value={content} onChange={setContent} targetRef={contentRef} />
                <EmojiPickerButton onInsert={(t) => setContent((prev) => prev + (prev ? " " : "") + t)} />
              </div>
            </div>
            <textarea ref={contentRef} value={content} onChange={(e) => setContent(e.target.value)} required rows={4} className={`${inputClass} resize-y`} placeholder="Write your announcement here..." />
            <div className="mt-2">
              <ReformatButton
                content={content}
                title={title}
                type="announcement"
                onAccept={(reformatted) => setContent(reformatted)}
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1" data-tour="announcement-category">
              <label className="block text-sm font-semibold text-bark-brown mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} cursor-pointer`}>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={() => setPinned(!pinned)}
                className={`px-3 py-2 rounded-md border-2 text-sm font-semibold transition-colors cursor-pointer ${
                  pinned ? "bg-gold/20 border-gold text-gold" : "border-bark-brown-light text-bark-brown-light hover:border-gold"
                }`}
              >
                📌 {pinned ? "Pinned" : "Pin"}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-bark-brown-light cursor-pointer">
            <input type="checkbox" checked={signAsAuthor} onChange={(e) => setSignAsAuthor(e.target.checked)} className="accent-gnome-green" />
            Sign the Discord post with my name
          </label>
          {/* Banner Generator */}
          <div data-tour="announcement-banner">
            <BannerGenerator
              title={title}
              description={content}
              type="announcement"
              currentBanner={bannerUrl || null}
              onBannerGenerated={(url) => setBannerUrl(url)}
            />
          </div>

          {/* Update Discord message (only when editing an already-posted announcement) */}
          {editingId && editingDiscordMessageId && !permLoading && canSyncDiscord && (
            <label className="flex items-center gap-2 text-sm text-bark-brown-light">
              <input type="checkbox" checked={syncDiscord} onChange={(e) => setSyncDiscord(e.target.checked)} />
              Also update the Discord message
            </label>
          )}

          {/* Extra Images */}
          {!editingId && (
            <ImageUploader images={extraImages} onChange={setExtraImages} maxImages={4} label="Additional Images (posted to Discord)" />
          )}

          {/* Role Pings */}
          <div data-tour="announcement-role-pings">
            <RolePingSelector selectedRoles={pingRoles} onChange={setPingRoles} />
          </div>

          {/* Post to Discord checkbox (only for new announcements) */}
          {!editingId && (
            <div className="flex items-start gap-3" data-tour="announcement-post-discord">
              <button
                type="button"
                onClick={() => setPostToDiscord(!postToDiscord)}
                className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  postToDiscord
                    ? "bg-gnome-green border-gnome-green"
                    : "border-bark-brown-light hover:border-gnome-green"
                }`}
              >
                {postToDiscord && (
                  <svg className="w-4 h-4 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div>
                <p className="font-semibold text-bark-brown">Post to Discord</p>
                <p className="text-xs text-bark-brown-light">
                  Also post this announcement to the #announcements channel in Discord.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={saving} data-tour="announcement-publish">
              {saving ? "Saving..." : editingId ? "Update" : "Publish"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setEditingId(null); setEditingDiscordMessageId(null); setTitle(""); setContent(""); setCategory("announcement"); setPinned(false); setBannerUrl(""); }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Live Preview */}
      {showPreview && (
        <div className="xl:sticky xl:top-20 xl:self-start">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-bark-brown">Discord Preview</h2>
            <span className={`text-xs font-semibold ${previewLines.length > 2000 ? "text-red-accent" : "text-iron-grey"}`}>
              {previewLines.length}/2000
            </span>
          </div>
          {previewLines.length > 2000 && (
            <p className="text-xs text-red-accent mb-3">
              Too long for a single Discord message — shorten the content before publishing.
            </p>
          )}
          <div className="bg-[#313338] text-[#dbdee1] font-sans text-sm leading-relaxed overflow-auto max-h-[80vh] rounded-lg border border-[#1e1f22] p-4 shadow-lg">
            <pre className="whitespace-pre-wrap break-words font-sans text-[13px]">
              {previewLines || <span className="text-[#72767d]">Fill in the form to see a preview...</span>}
            </pre>
            {previewImages.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {previewImages.map((url, i) => (
                  <img key={i} src={url} alt={`Preview ${i + 1}`} className="rounded max-h-32 w-auto shrink-0" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Existing Announcements */}
      <h2 className="font-display text-lg text-bark-brown mb-4">
        All Announcements ({announcements.length})
      </h2>
      <div className="space-y-3">
        {announcements.map((a) => (
          <Card key={a.id} hover={false} className={!a.published ? "opacity-60" : ""}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {a.pinned && <span className="text-xs">📌</span>}
                  <span className="text-xs text-iron-grey uppercase tracking-wide">
                    {CATEGORIES.find((c) => c.key === a.category)?.label ?? a.category}
                  </span>
                  {!a.published && (
                    <span className="text-xs bg-iron-grey/20 text-iron-grey px-1.5 py-0.5 rounded">Draft</span>
                  )}
                </div>
                <h3 className="font-display text-base text-bark-brown">{a.title}</h3>
                <p className="text-sm text-bark-brown-light mt-1 line-clamp-2">{a.content}</p>
                <p className="text-xs text-iron-grey mt-2">
                  {a.author_name ?? "Admin"} · {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleEdit(a)} className="text-xs text-gnome-green hover:underline cursor-pointer">Edit</button>
                <button onClick={() => handleTogglePublish(a)} className="text-xs text-iron-grey hover:underline cursor-pointer">
                  {a.published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-xs text-red-accent hover:underline cursor-pointer">Delete</button>
              </div>
            </div>
          </Card>
        ))}
        {announcements.length === 0 && (
          <p className="text-sm text-iron-grey">No announcements yet. Create one above!</p>
        )}
      </div>
    </div>
  );
}
