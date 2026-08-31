"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-3xl",
};

/** 1-5 star rating -- interactive (click to set, with hover preview) when onChange is passed and readOnly isn't set, otherwise a static display. */
export function StarRating({ value, onChange, readOnly = false, size = "md", className }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const interactive = !readOnly && !!onChange;
  const displayValue = hovered ?? value;

  return (
    <div className={cn("inline-flex items-center gap-0.5", SIZE_CLASS[size], className)} role={interactive ? "radiogroup" : undefined} aria-label={interactive ? "Rating" : `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => interactive && setHovered(n)}
          onMouseLeave={() => interactive && setHovered(null)}
          aria-label={interactive ? `${n} star${n === 1 ? "" : "s"}` : undefined}
          className={cn(
            "leading-none",
            interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default",
            n <= displayValue ? "text-gold" : "text-bark-brown-light/30"
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}
