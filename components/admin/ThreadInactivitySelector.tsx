"use client";

import { THREAD_AUTO_ARCHIVE_OPTIONS, type ThreadAutoArchive } from "@/lib/thread-archive";

interface ThreadInactivitySelectorProps {
  value: ThreadAutoArchive;
  onChange: (minutes: ThreadAutoArchive) => void;
  label?: string;
  /** Extra sentence after the standard help text, e.g. what this particular form's post is. */
  hint?: string;
}

/**
 * Picks the inactivity window Discord uses to auto-archive a forum post.
 * Sits beside a "Post To" destination on every form that can land in a
 * forum channel; it's a no-op when the destination is a plain channel.
 */
export function ThreadInactivitySelector({ value, onChange, label = "Forum post inactivity", hint }: ThreadInactivitySelectorProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as ThreadAutoArchive)}
        className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
      >
        {THREAD_AUTO_ARCHIVE_OPTIONS.map((o) => (
          <option key={o.minutes} value={o.minutes}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-iron-grey mt-1">
        How long with no replies before Discord archives the post. Only applies when the destination is a forum channel.
        {hint ? ` ${hint}` : ""}
      </p>
    </div>
  );
}
