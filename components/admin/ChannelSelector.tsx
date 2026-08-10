"use client";

import { useState, useEffect } from "react";

interface DiscordChannel {
  id: string;
  name: string;
  category: string | null;
}

interface DiscordThread {
  id: string;
  name: string;
  parentChannel: string | null;
}

interface ChannelSelectorProps {
  value: string;
  onChange: (channelId: string) => void;
  label?: string;
  /** Renders a "Use default" blank option first, for optional destination fields. */
  allowBlank?: boolean;
}

export function ChannelSelector({ value, onChange, label = "Post to Channel", allowBlank = false }: ChannelSelectorProps) {
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [threads, setThreads] = useState<DiscordThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchChannels() {
      try {
        const res = await fetch("/api/discord/channels");
        if (res.ok) {
          const data = await res.json();
          setChannels(data.channels ?? []);
          setThreads(data.threads ?? []);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchChannels();
  }, []);

  if (loading) {
    return <p className="text-xs text-iron-grey">Loading channels...</p>;
  }

  if (error || (channels.length === 0 && threads.length === 0)) {
    return <p className="text-xs text-red-accent">Couldn&apos;t load Discord channels. Check bot configuration.</p>;
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
      >
        {allowBlank ? (
          <option value="">Use default</option>
        ) : (
          <option value="" disabled>Select a channel...</option>
        )}
        {channels.length > 0 && (
          <optgroup label="Channels">
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category ? `${c.category} / ` : ""}#{c.name}
              </option>
            ))}
          </optgroup>
        )}
        {threads.length > 0 && (
          <optgroup label="Active Threads">
            {threads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.parentChannel ? `${t.parentChannel} / ` : ""}{t.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <p className="text-xs text-iron-grey mt-1">
        Only currently-active threads are listed. For an archived thread, paste its link or ID below instead.
      </p>
    </div>
  );
}
