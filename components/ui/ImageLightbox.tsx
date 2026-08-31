"use client";

import { useEffect } from "react";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/** Full-screen click-to-enlarge viewer for a single image -- dismissed by clicking the backdrop, the close button, or Escape. */
export function ImageLightbox({ src, alt = "", onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-6 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-bark-brown/80 text-parchment hover:bg-bark-brown text-xl flex items-center justify-center cursor-pointer"
      >
        ✕
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-md shadow-2xl cursor-default"
      />
    </div>
  );
}
