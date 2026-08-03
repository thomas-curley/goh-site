"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ACCESS_LEVEL_LABELS, type AccessLevel } from "@/lib/clan-access";
import type { MemberProfile, SocialLink } from "@/lib/gn0mebook";

const VISIBILITY_LEVELS: AccessLevel[] = ["anonymous", "verified_player", "clan_member"];
const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export function ProfileEditForm({ initialProfile, profileId }: { initialProfile: MemberProfile | null; profileId: string | null }) {
  const router = useRouter();

  const [tagline, setTagline] = useState(initialProfile?.tagline ?? "");
  const [about, setAbout] = useState(initialProfile?.about ?? "");
  const [interests, setInterests] = useState(initialProfile?.interests ?? "");
  const [playSchedule, setPlaySchedule] = useState(initialProfile?.play_schedule ?? "");
  const [inGameFocus, setInGameFocus] = useState(initialProfile?.in_game_focus ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(initialProfile?.banner_url ?? "");
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(initialProfile?.social_links ?? []);
  const [isPublished, setIsPublished] = useState(initialProfile?.is_published ?? true);
  const [visibility, setVisibility] = useState<AccessLevel>(initialProfile?.visibility ?? "anonymous");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const addSocialLink = () => setSocialLinks((prev) => [...prev, { label: "", url: "" }]);
  const updateSocialLink = (i: number, patch: Partial<SocialLink>) =>
    setSocialLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeSocialLink = (i: number) => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);

    const res = await fetch("/api/gn0mebook/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagline, about, interests,
        playSchedule, inGameFocus,
        avatarUrl, bannerUrl,
        socialLinks: socialLinks.filter((l) => l.label.trim() && l.url.trim()),
        isPublished, visibility,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setStatus("Saved!");
      router.refresh();
    } else {
      setError(data.error ?? "Failed to save.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete your Gn0meBook profile? This can't be undone.")) return;
    setDeleting(true);
    const res = await fetch("/api/gn0mebook/me", { method: "DELETE" });
    if (res.ok) {
      router.push("/gn0mebook");
      router.refresh();
    } else {
      setError("Failed to delete your profile.");
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>
      )}
      {status && (
        <div className="p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>
      )}

      <Card hover={false}>
        <label className="block text-sm font-semibold text-bark-brown mb-1">Tagline</label>
        <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={150} className={inputClass} placeholder="Raid leader & general troublemaker" />
      </Card>

      <Card hover={false}>
        <ImageUploader images={avatarUrl ? [avatarUrl] : []} onChange={(imgs) => setAvatarUrl(imgs[0] ?? "")} maxImages={1} label="Profile Picture (defaults to your Discord avatar)" />
      </Card>

      <Card hover={false}>
        <ImageUploader images={bannerUrl ? [bannerUrl] : []} onChange={(imgs) => setBannerUrl(imgs[0] ?? "")} maxImages={1} label="Cover Banner (optional)" />
      </Card>

      <Card hover={false}>
        <label className="block text-sm font-semibold text-bark-brown mb-1">About Me</label>
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={4} className={inputClass} placeholder="Who you are, how long you've played, whatever you want people to know." />
      </Card>

      <Card hover={false}>
        <label className="block text-sm font-semibold text-bark-brown mb-1">Things I Like To Do</label>
        <textarea value={interests} onChange={(e) => setInterests(e.target.value)} rows={3} className={inputClass} placeholder="PvM, PvP, skilling grinds, collection log hunting..." />
      </Card>

      <Card hover={false}>
        <label className="block text-sm font-semibold text-bark-brown mb-1">When I Usually Play</label>
        <textarea value={playSchedule} onChange={(e) => setPlaySchedule(e.target.value)} rows={2} className={inputClass} placeholder="Weeknights after 7pm EST, most weekend afternoons" />
      </Card>

      <Card hover={false}>
        <label className="block text-sm font-semibold text-bark-brown mb-1">What I Do In-Game</label>
        <textarea value={inGameFocus} onChange={(e) => setInGameFocus(e.target.value)} rows={2} className={inputClass} placeholder="Mostly bossing and helping out with raids" />
      </Card>

      <Card hover={false}>
        <label className="block text-sm font-semibold text-bark-brown mb-2">Find Me Elsewhere</label>
        <div className="space-y-2">
          {socialLinks.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={link.label} onChange={(e) => updateSocialLink(i, { label: e.target.value })} placeholder="Twitch" className={`${inputClass} w-32 shrink-0`} />
              <input type="text" value={link.url} onChange={(e) => updateSocialLink(i, { url: e.target.value })} placeholder="https://..." className={`${inputClass} flex-1`} />
              <button type="button" onClick={() => removeSocialLink(i)} className="text-red-accent text-xs cursor-pointer shrink-0 px-2">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addSocialLink} className="text-xs text-gnome-green hover:underline mt-2 cursor-pointer">+ Add link</button>
      </Card>

      <Card hover={false}>
        <label className="block text-sm font-semibold text-bark-brown mb-1">Who can view this profile</label>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as AccessLevel)} className={`${inputClass} cursor-pointer`}>
          {VISIBILITY_LEVELS.map((level) => (
            <option key={level} value={level}>{ACCESS_LEVEL_LABELS[level]}</option>
          ))}
        </select>
        <p className="text-xs text-iron-grey mt-1">
          &quot;Anonymous&quot; here means anyone, including visitors who aren&apos;t signed in.
        </p>
      </Card>

      <Card hover={false}>
        <label className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="accent-gnome-green" />
          Published (visible in the Gn0meBook directory)
        </label>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</Button>
        {profileId && (
          <button type="button" onClick={handleDelete} disabled={deleting} className="text-sm text-red-accent hover:underline cursor-pointer">
            {deleting ? "Deleting..." : "Delete my profile"}
          </button>
        )}
      </div>
    </form>
  );
}
