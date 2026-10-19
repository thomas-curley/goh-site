"use client";

import { useState } from "react";
import { tileGoal, tileIconSources, type BingoTile } from "@/lib/bingo";

/** A tile's item, skill or boss icon, trying each source in turn; nothing if none load. */
export function TileIcon({ tile, className = "w-8 h-8" }: { tile: Pick<BingoTile, "icon_kind" | "icon_ref" | "icon_item_id">; className?: string }) {
  const sources = tileIconSources(tile);
  const [attempt, setAttempt] = useState(0);
  if (attempt >= sources.length) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={sources[attempt]}
      src={sources[attempt]}
      alt=""
      onError={() => setAttempt((a) => a + 1)}
      className={`${className} object-contain [image-rendering:pixelated] drop-shadow-[0_1px_0_rgba(0,0,0,0.25)]`}
    />
  );
}

export type TileState = "empty" | "open" | "progress" | "pending" | "rejected" | "done";

const STATE_STYLE: Record<TileState, string> = {
  empty: "border-dashed border-bark-brown-light/50 bg-transparent text-iron-grey",
  open: "border-bark-brown-light/60 bg-parchment text-bark-brown",
  progress: "border-bark-brown-light/60 bg-parchment text-bark-brown",
  pending: "border-gold bg-gold/15 text-bark-brown",
  rejected: "border-red-accent bg-red-accent/10 text-bark-brown",
  done: "border-gnome-green bg-gnome-green/20 text-bark-brown",
};

/**
 * One square of a board: icon, name, points, and (for count and tracked
 * tiles) a progress bar. `inLine` adds the gold edge for a finished row,
 * column or diagonal. Rendered as a button when clickable.
 */
export function TileFace({
  tile,
  state,
  progress = 0,
  inLine = false,
  selected = false,
  label,
  onClick,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  tile: BingoTile | null;
  state: TileState;
  progress?: number;
  inLine?: boolean;
  selected?: boolean;
  label?: string;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler;
  onDragOver?: React.DragEventHandler;
  onDrop?: React.DragEventHandler;
}) {
  const goal = tile ? tileGoal(tile) : 0;
  const showBar = !!tile && state !== "done" && goal > 1 && progress > 0;
  const pct = goal > 0 ? Math.min(100, (progress / goal) * 100) : 0;
  const className = `group relative aspect-square w-full rounded-lg border-2 p-1 sm:p-1.5 flex flex-col items-center justify-center gap-0.5 text-center overflow-hidden transition-all ${STATE_STYLE[state]} ${
    inLine ? "shadow-[inset_0_0_0_2px_var(--color-gold-display)]" : ""
  } ${selected ? "ring-2 ring-offset-1 ring-gnome-green ring-offset-parchment" : ""} ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gnome-green" : ""}`;

  const inner = tile ? (
    <>
      <span className="absolute top-0.5 right-1 font-mono text-[9px] sm:text-[10px] text-iron-grey">{tile.points}</span>
      <TileIcon tile={tile} className="w-6 h-6 sm:w-8 sm:h-8" />
      <span lang="en" className="text-[9px] sm:text-[11px] font-semibold leading-tight line-clamp-3 [overflow-wrap:anywhere] hyphens-auto">{tile.title}</span>
      {showBar && (
        <span className="w-4/5 h-1 rounded-full bg-bark-brown-light/25 overflow-hidden" aria-hidden>
          <span className="block h-full bg-gnome-green" style={{ width: `${pct}%` }} />
        </span>
      )}
      {state === "done" && <span className="absolute bottom-0.5 right-1 text-gnome-green text-xs sm:text-sm font-black" aria-hidden>✓</span>}
      {state === "pending" && <span className="absolute bottom-0.5 right-1 text-[10px]" aria-hidden>⏳</span>}
      {state === "rejected" && <span className="absolute bottom-0.5 right-1 text-red-accent text-xs font-black" aria-hidden>!</span>}
    </>
  ) : (
    <span className="text-xs">{label}</span>
  );

  const aria = tile ? `${tile.title}, ${tile.points} ${tile.points === 1 ? "point" : "points"}, ${stateWords(state)}` : label;
  return onClick ? (
    <button type="button" onClick={onClick} className={className} aria-label={aria} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      {inner}
    </button>
  ) : (
    <div className={className} aria-label={aria} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      {inner}
    </div>
  );
}

function stateWords(state: TileState): string {
  return { empty: "empty", open: "not started", progress: "in progress", pending: "waiting on staff", rejected: "sent back", done: "done" }[state];
}
