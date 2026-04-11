"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerGenerator } from "@/components/admin/BannerGenerator";

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  published: boolean;
  banner_url: string | null;
  author_name: string | null;
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
  const [category, setCategory] = useState("announcement");
  const [pinned, setPinned] = useState(false);
  const [bannerUrl, setBannerUrl] = useState("");
  const [postToDiscord, setPostToDiscord] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

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
      setStatus("Announcement updated!");
    } else {
      const { error } = await supabase
        .from("announcements")
        .insert({
          title, content, category, pinned,
          banner_url: bannerUrl || null,
          author_id: user?.id,
          author_name: authorName,
        });
      if (error) { setStatus(`Error: ${error.message}`); setSaving(false); return; }

      // Post to Discord if checked
      if (postToDiscord) {
        try {
          await fetch("/api/announcements/post-discord", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, content, category, author: authorName, bannerUrl }),
          });
          setStatus("Announcement published and posted to Discord!");
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
    setEditingId(null);
    setSaving(false);
    await load();
  };

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id);
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

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-6">Announcements</h1>

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

      {/* Create / Edit Form */}
      <Card hover={false} className="mb-8">
        <h2 className="font-display text-lg text-bark-brown mb-4">
          {editingId ? "Edit Announcement" : "New Announcement"}
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} placeholder="Weekly Update" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={4} className={`${inputClass} resize-y`} placeholder="Write your announcement here..." />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
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
          {/* Banner Generator */}
          <BannerGenerator
            title={title}
            description={content}
            type="announcement"
            currentBanner={bannerUrl || null}
            onBannerGenerated={(url) => setBannerUrl(url)}
          />

          {/* Post to Discord checkbox (only for new announcements) */}
          {!editingId && (
            <div className="flex items-start gap-3">
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
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Publish"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setEditingId(null); setTitle(""); setContent(""); setCategory("announcement"); setPinned(false); setBannerUrl(""); }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

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
