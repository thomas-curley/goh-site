"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface UserProfile {
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  rsn: string | null;
  rsn_verified: boolean;
  clan_rank: string | null;
  linked_at: string | null;
}

interface AccountFormProps {
  userId: string;
  userMeta: Record<string, string>;
}

export function AccountForm({ userId, userMeta }: AccountFormProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsn, setRsn] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const supabase = createSupabaseBrowserClient();

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setProfile(data);
      if (data.rsn) setRsn(data.rsn);
    }
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleLinkRsn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsn.trim()) return;

    setSaving(true);
    setStatus(null);

    try {
      // Verify RSN exists on WOM
      const womRes = await fetch(
        `https://api.wiseoldman.net/v2/players/${encodeURIComponent(rsn.trim())}`
      );

      if (!womRes.ok) {
        setStatus({
          type: "error",
          message: `Player "${rsn.trim()}" not found on Wise Old Man. Make sure you've been tracked at least once.`,
        });
        setSaving(false);
        return;
      }

      const womPlayer = await womRes.json();

      // Check if player is in our WOM group (optional — for clan_rank)
      let clanRank: string | null = null;
      try {
        const groupRes = await fetch(
          "https://api.wiseoldman.net/v2/groups/24582"
        );
        if (groupRes.ok) {
          const group = await groupRes.json();
          const membership = group.memberships?.find(
            (m: { player: { username: string }; role: string }) =>
              m.player.username === womPlayer.username
          );
          if (membership) {
            clanRank = membership.role;
          }
        }
      } catch {
        // Non-critical
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({
          rsn: womPlayer.displayName,
          rsn_verified: true,
          clan_rank: clanRank,
          linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        setStatus({ type: "error", message: "Failed to save. Try again." });
      } else {
        setStatus({ type: "success", message: `RSN "${womPlayer.displayName}" linked successfully!` });
        await loadProfile();
      }
    } catch {
      setStatus({ type: "error", message: "Something went wrong. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setSaving(true);
    await supabase
      .from("user_profiles")
      .update({
        rsn: null,
        rsn_verified: false,
        clan_rank: null,
        linked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setRsn("");
    setStatus({ type: "success", message: "RSN unlinked." });
    await loadProfile();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  const avatarUrl = profile?.discord_avatar ?? userMeta?.avatar_url;
  const displayName = profile?.discord_username ?? userMeta?.full_name ?? "User";

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-8">My Account</h1>

      {/* Discord Profile */}
      <Card hover={false} className="mb-6">
        <h2 className="font-display text-xl text-bark-brown mb-4">Discord Profile</h2>
        <div className="flex items-center gap-4">
          {avatarUrl && (
            <img src={avatarUrl} alt="Discord avatar" className="w-12 h-12 rounded-full" />
          )}
          <div>
            <p className="font-mono font-bold text-bark-brown">{displayName}</p>
            {profile?.discord_id && (
              <p className="text-xs text-iron-grey">ID: {profile.discord_id}</p>
            )}
          </div>
        </div>
      </Card>

      {/* RSN Link */}
      <Card hover={false}>
        <h2 className="font-display text-xl text-bark-brown mb-4">Link Your RSN</h2>

        {profile?.rsn ? (
          <div>
            <div className="mb-4">
              <p className="text-sm text-iron-grey">Currently Linked RSN</p>
              <p className="font-mono text-lg font-bold text-gnome-green">{profile.rsn}</p>
              {profile.clan_rank && (
                <p className="text-xs text-bark-brown-light mt-1">
                  Clan Rank: <span className="capitalize">{profile.clan_rank.replace(/_/g, " ")}</span>
                </p>
              )}
              {profile.rsn_verified && (
                <p className="text-xs text-gnome-green-light mt-1">Verified via Wise Old Man</p>
              )}
            </div>

            <div className="border-t border-parchment-dark pt-4">
              <p className="text-sm text-bark-brown-light mb-3">Change your linked RSN:</p>
              <form onSubmit={handleLinkRsn} className="flex gap-3">
                <input
                  type="text"
                  value={rsn}
                  onChange={(e) => setRsn(e.target.value)}
                  placeholder="New RSN..."
                  className="flex-1 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-gnome-green"
                />
                <Button type="submit" disabled={saving} size="sm">
                  {saving ? "Saving..." : "Update"}
                </Button>
              </form>
              <button
                onClick={handleUnlink}
                disabled={saving}
                className="text-xs text-red-accent hover:underline mt-3 cursor-pointer"
              >
                Unlink RSN
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-bark-brown-light mb-4">
              Link your Old School RuneScape username so our Discord bot can look
              up your stats automatically. Your RSN will be verified against
              Wise Old Man.
            </p>
            <form onSubmit={handleLinkRsn} className="flex gap-3">
              <input
                type="text"
                value={rsn}
                onChange={(e) => setRsn(e.target.value)}
                placeholder="Enter your RSN..."
                required
                className="flex-1 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-gnome-green"
              />
              <Button type="submit" disabled={saving}>
                {saving ? "Verifying..." : "Link RSN"}
              </Button>
            </form>
          </div>
        )}

        {status && (
          <p className={`text-sm mt-4 ${status.type === "error" ? "text-red-accent" : "text-gnome-green"}`}>
            {status.message}
          </p>
        )}
      </Card>

      {/* How it works */}
      <Card hover={false} className="mt-6 bg-parchment-dark">
        <h3 className="font-display text-lg text-bark-brown mb-2">How does this work?</h3>
        <ul className="space-y-2 text-sm text-bark-brown-light">
          <li className="flex gap-2">
            <span className="text-gnome-green shrink-0">1.</span>
            Enter your OSRS username above — we verify it on Wise Old Man.
          </li>
          <li className="flex gap-2">
            <span className="text-gnome-green shrink-0">2.</span>
            Your RSN is linked to your Discord account in our database.
          </li>
          <li className="flex gap-2">
            <span className="text-gnome-green shrink-0">3.</span>
            Use Discord bot commands like <code className="font-mono text-gnome-green">!stats</code> — the
            bot looks up your RSN automatically.
          </li>
        </ul>
      </Card>
    </div>
  );
}
