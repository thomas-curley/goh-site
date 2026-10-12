"use client";

import { useState, useEffect } from "react";
import type { ChannelListResult } from "@/app/api/discord/channels/route";

interface ChannelSelectorProps {
  value: string;
  onChange: (channelId: string) => void;
  label?: string;
  /** Renders a "Use default" blank option first, for optional destination fields. */
  allowBlank?: boolean;
  /** Hide forum channels themselves (their posts stay listed) -- for things that can't start a forum post, like polls. */
  excludeForums?: boolean;
}

const KIND_ICON = { text: "#", announcement: "📢", forum: "💬" } as const;

// Every selector on a page shares one request (the alert channels page
// renders 15+ of them).
let channelListRequest: Promise<ChannelListResult | null> | null = null;
function loadChannelList(): Promise<ChannelListResult | null> {
  if (!channelListRequest) {
    channelListRequest = fetch("/api/discord/channels")
      .then((res) => (res.ok ? (res.json() as Promise<ChannelListResult>) : null))
      .catch(() => null)
      .then((data) => {
        // Don't cache a failure -- the next selector to mount retries.
        if (!data) channelListRequest = null;
        return data;
      });
  }
  return channelListRequest;
}

export function ChannelSelector({ value, onChange, label = "Post to Channel", allowBlank = false, excludeForums = false }: ChannelSelectorProps) {
  const [list, setList] = useState<ChannelListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadChannelList().then((data) => {
      if (cancelled) return;
      setList(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-xs text-iron-grey">Loading channels...</p>;
  }

  const hasAny = !!list && (list.groups.length > 0 || list.otherThreads.length > 0);
  if (!hasAny) {
    return <p className="text-xs text-red-accent">Couldn&apos;t load Discord channels. Check bot configuration.</p>;
  }

  const needle = filter.trim().toLowerCase();
  const matches = (...names: (string | null)[]) => !needle || names.some((n) => n?.toLowerCase().includes(needle));

  // Filtering keeps a channel if it, its category or any of its threads
  // matches; a matching channel or category shows all its threads.
  const groups = list.groups
    .map((g) => ({
      category: g.category,
      channels: g.channels
        .map((c) => {
          const channelMatches = matches(g.category, c.name);
          const threads = channelMatches ? c.threads : c.threads.filter((t) => matches(t.name));
          const selectable = !(excludeForums && c.kind === "forum");
          return { ...c, threads, selectable, visible: channelMatches || threads.length > 0 };
        })
        .filter((c) => c.visible && (c.selectable || c.threads.length > 0)),
    }))
    .filter((g) => g.channels.length > 0);
  const otherThreads = list.otherThreads.filter((t) => matches(t.name));
  const optionCount = groups.reduce((n, g) => n + g.channels.reduce((m, c) => m + 1 + c.threads.length, 0), 0) + otherThreads.length;

  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-2">{label}</label>
      <div className="flex gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          aria-label="Filter channels"
          className="w-28 sm:w-36 shrink-0 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green"
        />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
        >
          {allowBlank ? (
            <option value="">Use default</option>
          ) : (
            <option value="" disabled>
              {optionCount === 0 ? "No channels match the filter" : "Select a channel..."}
            </option>
          )}
          {groups.map((g) => (
            <optgroup key={g.category ?? "__none"} label={g.category ?? "No category"}>
              {g.channels.flatMap((c) => [
                <option key={c.id} value={c.id} disabled={!c.selectable}>
                  {KIND_ICON[c.kind]} {c.name}
                  {c.kind === "forum" ? (c.selectable ? " (new post)" : "") : ""}
                </option>,
                ...c.threads.map((t) => (
                  <option key={t.id} value={t.id}>
                    {"    "}↳ {t.name}
                  </option>
                )),
              ])}
            </optgroup>
          ))}
          {otherThreads.length > 0 && (
            <optgroup label="Other Threads">
              {otherThreads.map((t) => (
                <option key={t.id} value={t.id}>
                  ↳ {t.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <p className="text-xs text-iron-grey mt-1">
        Grouped by Discord category. Threads (↳) are listed under their channel -- only active ones, so for an
        archived thread paste its link or ID instead.
      </p>
    </div>
  );
}
