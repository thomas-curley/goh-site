"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface EventSignupFormProps {
  eventId: string;
  loggedIn: boolean;
  profile: { rsn: string | null; rsn_verified: boolean; discord_username: string | null } | null;
  alreadyCheckedIn: { rsn: string | null; discord_username: string | null } | null;
}

export function EventSignupForm({ eventId, loggedIn, profile, alreadyCheckedIn }: EventSignupFormProps) {
  const [checkedIn, setCheckedIn] = useState(alreadyCheckedIn);
  const [manualName, setManualName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVerifiedRsn = !!profile?.rsn_verified && !!profile?.rsn;

  const submit = async (name?: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualName: name ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to check in.");
        return;
      }
      setCheckedIn({ rsn: data.name, discord_username: profile?.discord_username ?? null });
      setEditingName(false);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!loggedIn) {
    return (
      <Card hover={false} className="text-center">
        <p className="text-sm text-bark-brown-light mb-4">
          Sign in with Discord to check in and be entered in the weekly raffle.
        </p>
        <a href={`/login?redirect=${encodeURIComponent(`/events/${eventId}/signup`)}`}>
          <Button size="lg" className="w-full">
            Sign In with Discord
          </Button>
        </a>
      </Card>
    );
  }

  if (checkedIn && !editingName) {
    return (
      <Card hover={false} className="text-center">
        <p className="text-gnome-green font-display text-lg mb-1">You&apos;re checked in!</p>
        <p className="text-sm text-bark-brown-light mb-4">
          Checked in as <span className="font-mono text-gnome-green">{checkedIn.rsn ?? checkedIn.discord_username}</span>.
          You&apos;re eligible for this week&apos;s raffle.
        </p>
        <p className="text-xs text-iron-grey mb-3">
          <Link href="/leaderboard" className="text-gnome-green hover:underline">See the attendance leaderboard</Link>
        </p>
        <button
          onClick={() => { setEditingName(true); setManualName(checkedIn.rsn ?? ""); }}
          className="text-xs text-iron-grey hover:underline cursor-pointer"
        >
          Not you, or need to fix the name? Update it
        </button>
      </Card>
    );
  }

  return (
    <Card hover={false}>
      {hasVerifiedRsn && !editingName ? (
        <div className="text-center">
          <p className="text-sm text-bark-brown-light mb-4">
            Check in as <span className="font-mono text-gnome-green">{profile!.rsn}</span>
          </p>
          <Button size="lg" className="w-full" disabled={saving} onClick={() => submit()}>
            {saving ? "Checking In..." : "Check In"}
          </Button>
          <button
            onClick={() => setEditingName(true)}
            className="text-xs text-iron-grey hover:underline mt-3 cursor-pointer"
          >
            Not your RSN? Enter a different name
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-bark-brown-light mb-3">
            {hasVerifiedRsn
              ? "Enter the name you'd like to check in with:"
              : "You haven't linked an RSN yet. Enter your RSN or name to check in:"}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualName.trim()) return;
              submit(manualName.trim());
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="RSN or name..."
              required
              maxLength={40}
              className="flex-1 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-gnome-green"
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Checking In..." : "Check In"}
            </Button>
          </form>
          {hasVerifiedRsn && (
            <button
              onClick={() => setEditingName(false)}
              className="text-xs text-iron-grey hover:underline mt-3 cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {error && <p className="text-red-accent text-sm mt-4">{error}</p>}
    </Card>
  );
}
