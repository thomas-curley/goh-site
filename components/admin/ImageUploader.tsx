"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  label?: string;
  /** Taller thumbnail grid for contexts where the image itself matters more than fitting many per row (e.g. reviewing a payout proof screenshot). Defaults to the compact size used everywhere else. */
  thumbnailSize?: "default" | "large";
}

export function ImageUploader({ images, onChange, maxImages = 5, label = "Images", thumbnailSize = "default" }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of files) {
      if (images.length + newUrls.length >= maxImages) break;

      const fileName = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
      const { error } = await supabase.storage
        .from("banners")
        .upload(fileName, file, { contentType: file.type, cacheControl: "31536000" });

      if (!error) {
        const { data: pub } = supabase.storage.from("banners").getPublicUrl(fileName);
        newUrls.push(pub.publicUrl);
      }
    }

    onChange([...images, ...newUrls]);
    setUploading(false);
    // Reset the input
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-2">{label}</label>

      {/* Image previews */}
      {images.length > 0 && (
        <div className={`grid gap-2 mb-3 ${thumbnailSize === "large" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {images.map((url, i) => (
            <div key={i} className="relative group">
              <img
                src={url}
                alt={`Upload ${i + 1}`}
                onClick={() => setLightboxUrl(url)}
                className={`w-full object-cover rounded-md border border-bark-brown-light cursor-pointer hover:opacity-90 transition-opacity ${thumbnailSize === "large" ? "h-48" : "h-24"}`}
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-accent text-text-light text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {images.length < maxImages && (
        <label className="block">
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={handleUpload}
            className="block w-full text-sm text-bark-brown-light file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gnome-green file:text-text-light hover:file:bg-gnome-green-light file:cursor-pointer cursor-pointer"
          />
          {uploading && <p className="text-xs text-iron-grey mt-1">Uploading...</p>}
          <p className="text-xs text-iron-grey mt-1">{images.length}/{maxImages} images</p>
        </label>
      )}

      {lightboxUrl && <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}
