"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RankBadge } from "@/components/ui/RankBadge";
import { ACCESS_LEVEL_LABELS, type AccessLevel } from "@/lib/clan-access";

interface AdminMemberProfile {
  id: string;
  tagline: string | null;
  is_published: boolean;
  visibility: AccessLevel;
  hidden_by_admin: boolean;
  created_at: string;
  user_profiles: { discord_username: string; rsn: string | null; clan_rank: string | null };
}

export default function AdminGn0meBookPage() {
  const [profiles, setProfiles] = useState<AdminMemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/gn0mebook");
    const data = await res.json().catch(() => ({}));
    setProfiles(res.ok ? data.profiles ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const toggleHidden = async (profile: AdminMemberProfile) => {
    setTogglingId(profile.id);
    await fetch(`/api/admin/gn0mebook/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: !profile.hidden_by_admin }),
    });
    await loadProfiles();
    setTogglingId(null);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Gn0meBook Profiles</h1>
      <p className="text-bark-brown-light mb-6">
        Every member profile, published or not. Hide a profile to pull it from the public directory without deleting it.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">No profiles created yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <Card key={profile.id} hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-bark-brown truncate">
                    {profile.user_profiles.rsn || profile.user_profiles.discord_username}
                    {profile.user_profiles.clan_rank && (
                      <span className="ml-2 align-middle"><RankBadge rank={profile.user_profiles.clan_rank} /></span>
                    )}
                    {!profile.is_published && <span className="ml-2 text-xs text-iron-grey">(Unpublished)</span>}
                    {profile.hidden_by_admin && <span className="ml-2 text-xs text-red-accent">(Hidden)</span>}
                  </p>
                  {profile.tagline && <p className="text-xs text-bark-brown-light truncate">{profile.tagline}</p>}
                  <p className="text-xs text-iron-grey">
                    Visibility: {ACCESS_LEVEL_LABELS[profile.visibility]} · {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                  <Link href={`/gn0mebook/${profile.id}`} target="_blank" className="text-xs text-gnome-green hover:underline">
                    View profile →
                  </Link>
                </div>
                <Button size="sm" variant="ghost" disabled={togglingId === profile.id} onClick={() => toggleHidden(profile)}>
                  {togglingId === profile.id ? "..." : profile.hidden_by_admin ? "Unhide" : "Hide"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
