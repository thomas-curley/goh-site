"use client";

import { useEffect, useState } from "react";

/**
 * Staff quick control for an event's check-in code: shows the current word
 * big enough to read out, with Copy, New code and Remove (or Add code when
 * the event has none) -- no trip to the full event edit form needed. Used in
 * the calendar's event pop-up and on the admin attendance page.
 */
export function CheckInCodeControl({ eventId, className = "" }: { eventId: string; className?: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/check-in-code`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setCode(data.code ?? null);
        else setError(data.error ?? "Couldn't load the code.");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the code.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const change = async (action: "generate" | "clear") => {
    if (action === "generate" && code && !confirm("Replace the current code? Anyone who hasn't checked in yet will need the new one.")) return;
    if (action === "clear" && !confirm("Remove the code? Anyone will be able to check in without one.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/check-in-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setCode(data.code ?? null);
    else setError(data.error ?? "Couldn't update the code.");
    setBusy(false);
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked -- the code is on screen to read out anyway.
    }
  };

  const linkButton = "text-xs text-gnome-green hover:underline cursor-pointer disabled:opacity-50";

  return (
    <div className={`p-3 rounded-md bg-parchment-dark/40 border border-parchment-dark ${className}`}>
      <p className="text-xs text-iron-grey uppercase tracking-wide">Check-In Code</p>
      {loading ? (
        <p className="text-sm text-iron-grey mt-1">Loading...</p>
      ) : code ? (
        <>
          <p className="font-mono text-2xl font-semibold text-gnome-green tracking-wide mt-1 break-all">{code}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <button type="button" onClick={copy} className={linkButton}>{copied ? "Copied!" : "Copy"}</button>
            <button type="button" onClick={() => change("generate")} disabled={busy} className={linkButton}>New code</button>
            <button type="button" onClick={() => change("clear")} disabled={busy} className="text-xs text-red-accent hover:underline cursor-pointer disabled:opacity-50">Remove</button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 mt-1">
          <p className="text-sm text-bark-brown-light">None -- anyone can check in.</p>
          <button
            type="button"
            onClick={() => change("generate")}
            disabled={busy || !!error}
            className="shrink-0 px-3 py-1.5 rounded-md bg-gnome-green text-parchment text-sm font-semibold hover:bg-gnome-green-light cursor-pointer disabled:opacity-50"
          >
            {busy ? "Adding..." : "Add code"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-accent mt-1">{error}</p>}
    </div>
  );
}
