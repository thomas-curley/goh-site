"use client";

import { useState } from "react";

// Discord avatar URLs go stale when a member changes their Discord picture
// without logging back into the site (the site only refreshes the stored
// hash on login) -- falls back to an initial-letter badge instead of a
// broken image icon when that happens.
export function ProfileAvatar({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="w-24 h-24 rounded-full object-cover border-4 border-parchment shadow-lg"
      />
    );
  }

  return (
    <div className="w-24 h-24 rounded-full bg-gnome-green/15 flex items-center justify-center text-3xl font-display text-gnome-green border-4 border-parchment shadow-lg">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
