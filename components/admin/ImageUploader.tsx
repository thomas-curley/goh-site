"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/Button";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  label?: string;
}

export function ImageUploader({ images, onChange, maxImages = 5, label = "Images" }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {images.map((url, i) => (
            <div key={i} className="relative group">
              <img src={url} alt={`Upload ${i + 1}`} className="w-full h-24 object-cover rounded-md border border-bark-brown-light" />
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
    </div>
  );
}
