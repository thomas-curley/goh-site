"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const MAX_BYTES = 20 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export interface ArtImage {
  path: string;
  preview: string;
}

/**
 * Artwork picker: drag and drop or browse. Each image goes straight to the
 * contest's private storage through a one-time upload link from the site,
 * so large files aren't limited by the site's request size.
 */
export function ArtUploader({ contestId, images, onChange, max }: { contestId: string; images: ArtImage[]; onChange: (images: ArtImage[]) => void; max: number }) {
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(images);
  latest.current = images;

  const upload = async (files: File[]) => {
    setError(null);
    const room = max - latest.current.length;
    const usable = files.filter((f) => TYPES.includes(f.type)).slice(0, room);
    if (files.length && !usable.length) return setError(room <= 0 ? `Up to ${max} ${max === 1 ? "image" : "images"} per entry.` : "Use a PNG, JPG, WebP or GIF image.");
    const supabase = createSupabaseBrowserClient();
    for (const file of usable) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is over 20 MB.`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const res = await fetch(`/api/art/${contestId}/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type }) });
        const slot = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(slot.error ?? "Couldn't start the upload.");
        const { error: upErr } = await supabase.storage.from("art").uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type });
        if (upErr) throw new Error("The upload failed. Try again.");
        onChange([...latest.current, { path: slot.path, preview: URL.createObjectURL(file) }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "The upload failed.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...images];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={img.path} className="relative rounded-md overflow-hidden border border-bark-brown-light/40 bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt={`Image ${i + 1}`} className="w-full h-32 object-contain" />
              <div className="absolute top-1 right-1 flex gap-1">
                {i > 0 && (
                  <button type="button" aria-label="Move earlier" onClick={() => move(i, -1)} className="w-6 h-6 rounded bg-black/60 text-white text-xs cursor-pointer">
                    ←
                  </button>
                )}
                <button type="button" aria-label="Remove image" onClick={() => onChange(images.filter((x) => x.path !== img.path))} className="w-6 h-6 rounded bg-black/60 text-white text-xs cursor-pointer">
                  ✕
                </button>
              </div>
              {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">Cover</span>}
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
          className={`w-full rounded-md border-2 border-dashed px-4 py-6 text-sm cursor-pointer transition-colors ${over ? "border-gnome-green bg-gnome-green/10" : "border-bark-brown-light/50 hover:bg-parchment-dark/40"}`}
        >
          <span className="font-semibold text-bark-brown">{uploading ? "Uploading..." : images.length ? "Add another image" : "Drop your artwork here"}</span>
          <span className="block text-xs text-iron-grey">
            or click to browse · PNG, JPG, WebP or GIF up to 20 MB · {max - images.length} more allowed
          </span>
        </button>
      )}
      <input ref={input} type="file" accept={TYPES.join(",")} multiple className="hidden" onChange={(e) => upload(Array.from(e.target.files ?? []))} />
      {error && <p className="text-xs text-red-accent">{error}</p>}
    </div>
  );
}
