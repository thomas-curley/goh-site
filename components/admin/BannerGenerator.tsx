"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface BannerGeneratorProps {
  title: string;
  description?: string;
  eventType?: string;
  type: "event" | "announcement";
  onBannerGenerated: (url: string) => void;
  currentBanner?: string | null;
}

// Discord's Guild Scheduled Event cover image renders at 800x320 -- anything
// else gets cropped/stretched unpredictably by Discord's own client, so
// uploads for event banners are center-cropped to this exact size client-side
// before they ever leave the browser.
const EVENT_BANNER_WIDTH = 800;
const EVENT_BANNER_HEIGHT = 320;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image file."));
    img.src = URL.createObjectURL(file);
  });
}

/** Center-crops (cover-fit, no distortion) an image to exactly width x height, returned as a PNG blob. */
async function cropToSize(file: File, width: number, height: number): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");

  const targetRatio = width / height;
  const sourceRatio = img.width / img.height;
  let sx: number, sy: number, sw: number, sh: number;
  if (sourceRatio > targetRatio) {
    sh = img.height;
    sw = sh * targetRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / targetRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to process image."))), "image/png");
  });
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    setRevisedPrompt(null);

    try {
      // Only Discord Scheduled Events (type "event") need the exact 800x320
      // cover-image dimensions -- announcement banners are just message
      // embed images, with no fixed-size requirement.
      const uploadBlob = type === "event" ? await cropToSize(file, EVENT_BANNER_WIDTH, EVENT_BANNER_HEIGHT) : file;
      const contentType = type === "event" ? "image/png" : file.type;
      const ext = type === "event" ? "png" : file.name.split(".").pop() || "png";

      const supabase = createSupabaseBrowserClient();
      const fileName = `banner_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(fileName, uploadBlob, { contentType, cacheControl: "31536000" });

      if (uploadError) {
        setError("Failed to upload image. Try again.");
        return;
      }

      const { data: pub } = supabase.storage.from("banners").getPublicUrl(fileName);
      onBannerGenerated(pub.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image.");
    } finally {
      setUploading(false);
    }
  };

  const busy = generating || uploading;

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

      {/* Generate / Upload / Remove */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          variant="ghost"
          size="sm"
        >
          {uploading ? "Uploading..." : "Upload Your Own"}
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
        Generates a 1792x1024 banner using DALL-E 3 (~$0.04/image), or upload your own
        {type === "event" ? " -- automatically cropped to 800x320 for Discord's event calendar card" : ""}.
        The image is stored permanently in Supabase.
      </p>
    </Card>
  );
}
