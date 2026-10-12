"use client";

import { useState } from "react";

/** Copies this issue's permanent link -- for pasting into Discord. */
export function CopyLinkButton({ path, className }: { path: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link:", url);
        }
      }}
      className={className}
    >
      {copied ? "✓ Link copied" : "🔗 Copy link"}
    </button>
  );
}
