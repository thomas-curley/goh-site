"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CLAN_NAME } from "@/lib/constants";

type Step = "choice" | "rsn";

export function OnboardingFlow({ userId, redirectTo }: { userId: string; redirectTo: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [step, setStep] = useState<Step>("choice");
  const [members, setMembers] = useState<string[]>([]);
  const [rsn, setRsn] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "taken"; message: string } | null>(null);

  useEffect(() => {
    if (step !== "rsn" || members.length > 0) return;
    fetch("/api/clan-members")
      .then((res) => res.json())
      .then((data) => setMembers((data.members ?? []).map((m: { displayName: string }) => m.displayName)))
      .catch(() => setMembers([]));
  }, [step, members.length]);

  const suggestions = useMemo(() => {
    const q = rsn.trim().toLowerCase();
    if (!q) return [];
    return members.filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [rsn, members]);

  const handleGuest = async () => {
    setSaving(true);
    await fetch("/api/account/onboarding", { method: "PATCH" });
    router.push(redirectTo);
  };

  const handleLinkRsn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsn.trim()) return;

    setSaving(true);
    setStatus(null);

    try {
      const womRes = await fetch(`https://api.wiseoldman.net/v2/players/${encodeURIComponent(rsn.trim())}`);
      if (!womRes.ok) {
        setStatus({ type: "error", message: `Player "${rsn.trim()}" not found on Wise Old Man. Make sure you've been tracked at least once.` });
        setSaving(false);
        return;
      }
      const womPlayer = await womRes.json();

      const typed = rsn.trim().replace(/[-_]/g, " ").replace(/\s+/g, " ");
      const womName: string = womPlayer.displayName ?? typed;
      const displayRsn = womName === womName.toLowerCase() ? typed : womName;

      const { data: existing } = await supabase
        .from("user_profiles")
        .select("id, discord_username")
        .ilike("rsn", displayRsn)
        .neq("id", userId)
        .maybeSingle();

      if (existing) {
        setStatus({
          type: "taken",
          message: `"${displayRsn}" is already linked to another Discord account. If this is your RSN, head to your Account page to request an admin reset.`,
        });
        setSaving(false);
        return;
      }

      let clanRank: string | null = null;
      try {
        const groupRes = await fetch("https://api.wiseoldman.net/v2/groups/24582");
        if (groupRes.ok) {
          const group = await groupRes.json();
          const membership = group.memberships?.find(
            (m: { player: { username: string }; role: string }) => m.player.username === womPlayer.username
          );
          if (membership) clanRank = membership.role;
        }
      } catch {
        // Non-critical
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({
          rsn: displayRsn,
          rsn_verified: true,
          clan_rank: clanRank,
          linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        if (error.code === "23505") {
          setStatus({ type: "taken", message: `"${displayRsn}" is already linked to another account. Head to your Account page to request an admin reset.` });
        } else {
          setStatus({ type: "error", message: "Failed to save. Try again." });
        }
        setSaving(false);
        return;
      }

      router.push(redirectTo);
    } catch {
      setStatus({ type: "error", message: "Something went wrong. Try again." });
      setSaving(false);
    }
  };

  if (step === "choice") {
    return (
      <Card hover={false} className="max-w-md w-full text-center py-10 px-8">
        <h1 className="font-display text-3xl text-gnome-green mb-2">Welcome to {CLAN_NAME}!</h1>
        <p className="text-bark-brown-light mb-8">Are you a clan member, or just visiting?</p>
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={() => setStep("rsn")}>I&apos;m a Clan Member</Button>
          <Button size="lg" variant="ghost" onClick={handleGuest} disabled={saving}>
            {saving ? "One sec..." : "Just a Guest"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card hover={false} className="max-w-md w-full py-10 px-8">
      <h1 className="font-display text-3xl text-gnome-green mb-2 text-center">Link Your RSN</h1>
      <p className="text-bark-brown-light mb-6 text-center">
        Enter your Old School RuneScape username. We&apos;ll verify it against Wise Old Man.
      </p>

      <form onSubmit={handleLinkRsn} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={rsn}
            onChange={(e) => { setRsn(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Your RSN..."
            required
            autoComplete="off"
            className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-gnome-green"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 card-wood py-1 z-10 shadow-xl max-h-48 overflow-y-auto">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={() => { setRsn(name); setShowSuggestions(false); }}
                  className="block w-full text-left px-3 py-1.5 text-sm font-mono text-bark-brown hover:bg-parchment-dark transition-colors cursor-pointer"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Verifying..." : "Link RSN"}
        </Button>
      </form>

      {status && (
        <p className={`text-sm mt-4 ${status.type === "error" || status.type === "taken" ? "text-red-accent" : "text-gnome-green"}`}>
          {status.message}
        </p>
      )}

      <button
        type="button"
        onClick={() => setStep("choice")}
        className="text-xs text-iron-grey hover:underline mt-4 cursor-pointer block mx-auto"
      >
        ← Back
      </button>
    </Card>
  );
}
