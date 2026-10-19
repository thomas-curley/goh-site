"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Screenshot drop zone for bingo proof: drag and drop, browse, or paste
 * (Ctrl/Cmd+V anywhere on the page while it's open). Files go straight to
 * site storage and come back as URLs.
 */
export function ProofUploader({ images, onChange, max = 4 }: { images: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(images);
  latest.current = images;

  const upload = async (files: File[]) => {
    setError(null);
    const room = max - latest.current.length;
    const usable = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (files.length && !usable.length) return setError(room <= 0 ? `Up to ${max} screenshots.` : "That isn't an image.");
    const supabase = createSupabaseBrowserClient();
    setUploading((n) => n + usable.length);
    for (const file of usable) {
      if (file.size > MAX_BYTES) {
        setError("Screenshots need to be under 10 MB.");
        setUploading((n) => n - 1);
        continue;
      }
      const ext = file.type.split("/")[1] || "png";
      const name = `bingo_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("banners").upload(name, file, { contentType: file.type, cacheControl: "31536000" });
      if (upErr) setError("Upload failed. Are you signed in?");
      else onChange([...latest.current, supabase.storage.from("banners").getPublicUrl(name).data.publicUrl]);
      setUploading((n) => n - 1);
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        upload(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {images.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Your screenshot" className="w-full h-28 object-cover rounded-md border border-bark-brown-light/40" />
              <button
                type="button"
                aria-label="Remove screenshot"
                onClick={() => onChange(images.filter((u) => u !== url))}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-bark-brown/80 text-parchment text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < max && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            upload(Array.from(e.dataTransfer.files));
          }}
          className={`w-full rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm cursor-pointer transition-colors ${
            over ? "border-gnome-green bg-gnome-green/10 text-gnome-green" : "border-bark-brown-light/50 text-iron-grey hover:border-gnome-green hover:text-gnome-green"
          }`}
        >
          {uploading > 0 ? (
            "Uploading..."
          ) : (
            <>
              <span className="block font-semibold text-bark-brown">Drop a screenshot here</span>
              <span className="block text-xs mt-0.5">or click to browse, or paste it with Ctrl+V</span>
            </>
          )}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {error && <p className="text-xs text-red-accent">{error}</p>}
    </div>
  );
}
