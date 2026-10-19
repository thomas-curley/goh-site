"use client";

import { useState } from "react";
import { tileGoal, tileIconSources, type BingoTile } from "@/lib/bingo";

type IconTile = Pick<BingoTile, "icon_kind" | "icon_ref" | "icon_item_id"> & { kind?: BingoTile["kind"] };

/** Drawn when a tile has no icon (or none of its images load), so every tile keeps the same shape. */
function PlaceholderIcon({ kind, className }: { kind?: BingoTile["kind"]; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} bingo-placeholder text-bark-brown-light/45`} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === "auto" ? (
        // rising bars: tracked progress
        <>
          <path d="M4 20h16" />
          <path d="M7 16v-4M12 16V8M17 16V5" />
        </>
      ) : (
        // gem: a drop or item
        <>
          <path d="M6 4h12l3 5-9 11L3 9z" />
          <path d="M3 9h18M9 4l3 16M15 4l-3 16" />
        </>
      )}
    </svg>
  );
}

/** A tile's item, skill or boss icon, trying each source in turn; a neutral placeholder if none load. */
export function TileIcon({ tile, className = "w-8 h-8", placeholder = true }: { tile: IconTile; className?: string; placeholder?: boolean }) {
  const sources = tileIconSources(tile);
  const [attempt, setAttempt] = useState(0);
  if (attempt >= sources.length) return placeholder ? <PlaceholderIcon kind={tile.kind} className={className} /> : null;
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
  empty: "border-dashed border-bark-brown-light/40 bg-transparent text-iron-grey",
  open: "border-bark-brown-light/35 bg-parchment text-bark-brown",
  progress: "border-bark-brown-light/35 bg-parchment text-bark-brown",
  pending: "border-gold bg-gold/10 text-bark-brown",
  rejected: "border-red-accent/80 bg-red-accent/[0.07] text-bark-brown",
  done: "border-gnome-green bg-gnome-green/[0.14] text-bark-brown",
};

/** Corner badge for a tile's state: a check, a clock or an exclamation mark. */
function StateBadge({ state }: { state: TileState }) {
  if (state !== "done" && state !== "pending" && state !== "rejected") return null;
  const bg = state === "done" ? "bg-gnome-green" : state === "pending" ? "bg-gold" : "bg-red-accent";
  return (
    <span className={`absolute top-[5cqw] right-[5cqw] w-[17cqw] h-[17cqw] min-w-3.5 min-h-3.5 max-w-6 max-h-6 rounded-full ${bg} text-white flex items-center justify-center shadow-sm`} aria-hidden>
      <svg viewBox="0 0 16 16" className="w-[62%] h-[62%]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {state === "done" && <path d="M3.5 8.5l3 3 6-7" />}
        {state === "pending" && (
          <>
            <circle cx="8" cy="8" r="5.2" strokeWidth={1.8} />
            <path d="M8 5.2V8l1.9 1.4" strokeWidth={1.8} />
          </>
        )}
        {state === "rejected" && <path d="M8 3.5v5.5M8 12.3v.2" />}
      </svg>
    </span>
  );
}

/**
 * One square of a board. Everything inside is sized from the tile's own
 * width (container query units), so a 3×3 board on a desktop and a 7×7
 * board on a phone keep the same proportions: points top left, state badge
 * top right, icon and name centred, and a progress bar along the bottom for
 * count and tracked tiles. `inLine` adds the gold ring for a finished row,
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
  const showBar = !!tile && state !== "done" && goal > 1;
  const pct = goal > 0 ? Math.min(100, (progress / goal) * 100) : 0;
  const ring = selected
    ? "ring-2 ring-gnome-green ring-offset-2 ring-offset-parchment"
    : inLine
      ? "ring-2 ring-gold-display shadow-[0_0_10px_rgba(218,165,32,0.35)]"
      : "";
  const className = `@container group relative aspect-square w-full min-w-0 rounded-[9%] border-2 overflow-hidden select-none transition-[transform,box-shadow] duration-150 ${STATE_STYLE[state]} ${ring} ${
    onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gnome-green" : ""
  }`;

  const inner = tile ? (
    <>
      <span className="bingo-points absolute top-[5cqw] left-[5cqw] rounded-full bg-bark-brown/10 px-[5cqw] font-mono font-semibold leading-[1.6] text-bark-brown-light text-[clamp(7px,9cqw,12px)] tabular-nums @max-[56px]:text-[7px] @max-[56px]:px-[3px]">
        {tile.points}
      </span>
      <StateBadge state={state} />
      {/* Roomy tiles show the icon and a two-line name; compact ones (phones, big boards) a larger icon and one
          line ending in "…"; tiny ones (7×7 on a phone) only the icon. The full name is in the tooltip and the tile panel. */}
      <span className="absolute inset-x-[7cqw] top-[22cqw] bottom-[15cqw] flex flex-col items-center justify-start gap-[4cqw] @max-[96px]:top-[21cqw] @max-[96px]:bottom-[13cqw] @max-[96px]:gap-[3cqw] @max-[56px]:top-[14cqw] @max-[56px]:bottom-[10cqw] @max-[56px]:justify-center">
        <span className="h-[34cqw] w-[34cqw] shrink-0 flex items-center justify-center @max-[96px]:h-[42cqw] @max-[96px]:w-[42cqw] @max-[56px]:h-[56cqw] @max-[56px]:w-[56cqw]">
          <TileIcon tile={tile} className="max-h-full max-w-full h-full w-full" />
        </span>
        <span
          lang="en"
          className="w-full text-center font-semibold leading-[1.15] text-[clamp(8px,10.5cqw,14px)] line-clamp-2 [overflow-wrap:anywhere] hyphens-auto @max-[96px]:block @max-[96px]:truncate @max-[96px]:text-[clamp(7.5px,12.5cqw,12px)] @max-[96px]:[overflow-wrap:normal] @max-[56px]:hidden"
        >
          {tile.title}
        </span>
      </span>
      {showBar && (
        <span className="absolute inset-x-[10cqw] bottom-[7cqw] h-[4.5cqw] min-h-[3px] @max-[96px]:bottom-[6cqw] rounded-full bg-bark-brown-light/20 overflow-hidden" aria-hidden>
          <span className="bingo-bar block h-full rounded-full bg-gnome-green transition-[width]" style={{ width: `${pct}%` }} />
        </span>
      )}
    </>
  ) : (
    <span className="absolute inset-0 flex items-center justify-center font-mono text-[clamp(9px,14cqw,16px)]">{label}</span>
  );

  const aria = tile ? `${tile.title}, ${tile.points} ${tile.points === 1 ? "point" : "points"}, ${stateWords(state)}` : label;
  const props = { className, "data-tile-state": state, "aria-label": aria, title: tile?.title, draggable, onDragStart, onDragOver, onDrop };
  return onClick ? (
    <button type="button" onClick={onClick} {...props}>
      {inner}
    </button>
  ) : (
    <div {...props}>{inner}</div>
  );
}

function stateWords(state: TileState): string {
  return { empty: "empty", open: "not started", progress: "in progress", pending: "waiting on staff", rejected: "sent back", done: "done" }[state];
}
