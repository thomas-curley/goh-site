"use client";

import { useEffect, useState } from "react";

/** The current time, updated every 30 seconds. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** "2d 4h", "3h 12m", "45m": time until `iso`, ticking each minute. */
export function useCountdown(iso: string | null): string | null {
  const now = useNow();
  if (!iso) return null;
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function Countdown({ to, prefix, ended }: { to: string | null; prefix: string; ended?: string }) {
  const left = useCountdown(to);
  if (!left) return ended ? <span>{ended}</span> : null;
  return (
    <span>
      {prefix} <span className="font-semibold tabular-nums">{left}</span>
    </span>
  );
}
