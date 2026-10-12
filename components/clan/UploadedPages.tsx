"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

/** Uploaded page images stacked full width; tap one to view it full screen. */
export function UploadedPages({ title, pageUrls }: { title: string; pageUrls: string[] }) {
  const [zoomed, setZoomed] = useState<number | null>(null);
  const count = pageUrls.length;

  return (
    <>
      <div className="space-y-6">
        {pageUrls.map((url, i) => (
          <figure key={url}>
            <button type="button" onClick={() => setZoomed(i)} className="block w-full cursor-pointer" title="Tap to view full size">
              {/* Plain <img>: full-page graphics of unknown size, served straight from storage. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={count > 1 ? `${title}, page ${i + 1} of ${count}` : title}
                loading={i === 0 ? "eager" : "lazy"}
                className="w-full h-auto rounded-md border border-bark-brown-light/40 shadow-md bg-white"
              />
            </button>
            {count > 1 && <figcaption className="mt-2 text-center text-xs text-iron-grey">Page {i + 1} of {count}</figcaption>}
          </figure>
        ))}
      </div>
      {zoomed !== null && <ImageLightbox src={pageUrls[zoomed]} alt={title} onClose={() => setZoomed(null)} />}
    </>
  );
}
