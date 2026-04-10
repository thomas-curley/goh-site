"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface BannerGeneratorProps {
  title: string;
  description?: string;
  eventType?: string;
  type: "event" | "announcement";
  onBannerGenerated: (url: string) => void;
  currentBanner?: string | null;
}

export function BannerGenerator({
  title,
  description,
  eventType,
  type,
  onBannerGenerated,
  currentBanner,
}: BannerGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!title.trim()) {
      setError("Enter a title first before generating a banner.");
      return;
    }

    setGenerating(true);
    setError(null);
    setRevisedPrompt(null);

    try {
      const res = await fetch("/api/banners/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          eventType,
          type,
          customPrompt: showCustom ? customPrompt : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate banner.");
        return;
      }

      onBannerGenerated(data.url);
      if (data.revised_prompt) setRevisedPrompt(data.revised_prompt);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card hover={false}>
      <h3 className="font-display text-lg text-bark-brown mb-3">
        Banner Image
      </h3>

      {/* Current banner preview */}
      {currentBanner && (
        <div className="mb-4">
          <img
            src={currentBanner}
            alt="Event banner"
            className="w-full rounded-md border border-bark-brown-light object-cover max-h-48"
          />
        </div>
      )}

      {/* Custom prompt toggle */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="text-sm text-gnome-green hover:text-gnome-green-light cursor-pointer"
        >
          {showCustom ? "Use auto-generated prompt" : "Write a custom prompt"}
        </button>

        {showCustom && (
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Describe the banner image you want... (OSRS fantasy style will be applied automatically)"
            rows={3}
            className="w-full mt-2 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green resize-y"
          />
        )}
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          variant="secondary"
          size="sm"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-text-light/30 border-t-text-light rounded-full animate-spin" />
              Generating...
            </span>
          ) : currentBanner ? (
            "Regenerate Banner"
          ) : (
            "Generate Banner"
          )}
        </Button>

        {currentBanner && (
          <button
            type="button"
            onClick={() => onBannerGenerated("")}
            className="text-xs text-red-accent hover:underline cursor-pointer"
          >
            Remove Banner
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-accent mt-3">{error}</p>
      )}

      {revisedPrompt && (
        <details className="mt-3">
          <summary className="text-xs text-iron-grey cursor-pointer hover:text-bark-brown-light">
            View DALL-E revised prompt
          </summary>
          <p className="text-xs text-iron-grey mt-1 bg-parchment-dark p-2 rounded">
            {revisedPrompt}
          </p>
        </details>
      )}

      <p className="text-xs text-iron-grey mt-3">
        Generates a 1792x1024 banner using DALL-E 3 (~$0.04/image).
        The image is stored permanently in Supabase.
      </p>
    </Card>
  );
}
