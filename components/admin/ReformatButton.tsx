"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ReformatButtonProps {
  content: string;
  title?: string;
  type: "event" | "announcement";
  onAccept: (reformatted: string) => void;
}

export function ReformatButton({ content, title, type, onAccept }: ReformatButtonProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReformat = async () => {
    if (!content.trim()) {
      setError("Write some content first before reformatting.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const res = await fetch("/api/content/reformat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title, type }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reformat failed.");
        return;
      }

      setSuggestion(data.reformatted);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleReformat}
        disabled={loading || !content.trim()}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-bark-brown-light/30 border-t-bark-brown rounded-full animate-spin" />
            Reformatting...
          </span>
        ) : (
          "✨ AI Reformat for Discord"
        )}
      </Button>

      {error && (
        <p className="text-xs text-red-accent mt-2">{error}</p>
      )}

      {suggestion && (
        <div className="mt-3 border border-gnome-green/30 rounded-lg overflow-hidden">
          {/* Preview header */}
          <div className="bg-gnome-green/10 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gnome-green">AI Suggestion</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onAccept(suggestion);
                  setSuggestion(null);
                }}
                className="text-xs font-semibold text-gnome-green hover:text-gnome-green-light cursor-pointer px-2 py-1 rounded hover:bg-gnome-green/10"
              >
                ✓ Use This
              </button>
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                className="text-xs text-iron-grey hover:text-bark-brown cursor-pointer px-2 py-1 rounded hover:bg-parchment-dark"
              >
                ✕ Dismiss
              </button>
            </div>
          </div>

          {/* Discord-styled preview */}
          <div className="bg-[#313338] p-4 rounded-b-lg">
            <pre className="whitespace-pre-wrap break-words font-sans text-[13px] text-[#dbdee1] leading-relaxed">
              {suggestion}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
