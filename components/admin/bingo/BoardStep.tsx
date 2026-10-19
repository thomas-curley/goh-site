"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TileFace } from "@/components/bingo/TileFace";
import { shuffled } from "@/lib/bingo";
import { BLANK_TILE, TileEditor, type TileDraft } from "./TileEditor";
import { inputClass } from "./BasicsStep";
import type { AdminBingo } from "./BingoBuilder";

/** "Title | points | how many" per line -> tiles for empty squares. */
function parsePasted(text: string): TileDraft[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, points, count] = line.split(/\s*[|\t]\s*/);
      const name = title.replace(/^[-*•\d.)\s]+/, "").trim();
      return {
        ...BLANK_TILE,
        title: name.slice(0, 80),
        points: points && !Number.isNaN(Number(points)) ? Math.max(0, Number(points)) : 1,
        required_count: count && Number(count) > 1 ? Math.floor(Number(count)) : 1,
        // Most pasted tiles are item names; the wiki has an icon for most of them.
        icon_kind: "item" as const,
        icon_ref: name.slice(0, 120),
      };
    })
    .filter((t) => t.title);
}

export function BoardStep({ data, onChanged, onNext }: { data: AdminBingo; onChanged: () => Promise<void>; onNext: () => void }) {
  const { event, tiles } = data;
  const n = event.grid_size;
  const squares = n * n;
  const byPos = new Map(tiles.map((t) => [t.position, t]));
  const firstEmpty = Array.from({ length: squares }, (_, p) => p).find((p) => !byPos.has(p));
  const [selected, setSelected] = useState<number>(firstEmpty ?? 0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmShuffle, setConfirmShuffle] = useState(false);
  const live = event.status === "active";

  const saveTile = async (draft: TileDraft): Promise<string | null> => {
    const res = await fetch(`/api/admin/bingo/${event.id}/tiles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: selected, tile: draft }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return json.error ?? "Couldn't save the tile.";
    const wasNew = !byPos.has(selected);
    await onChanged();
    // Move straight on to the next empty square when filling the board.
    if (wasNew) {
      const next = Array.from({ length: squares }, (_, i) => (selected + 1 + i) % squares).find((p) => p !== selected && !byPos.has(p));
      if (next != null) setSelected(next);
    }
    return null;
  };

  const clearTile = async () => {
    await fetch(`/api/admin/bingo/${event.id}/tiles?position=${selected}`, { method: "DELETE" });
    await onChanged();
  };

  const arrange = async (order: (string | null)[]) => {
    setBusy(true);
    const res = await fetch(`/api/admin/bingo/${event.id}/tiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "arrange", order }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setNotice({ ok: false, text: json.error ?? "Couldn't move the tiles." });
    await onChanged();
    setBusy(false);
  };

  const currentOrder = () => Array.from({ length: squares }, (_, p) => byPos.get(p)?.id ?? null);

  const swap = (from: number, to: number) => {
    if (from === to) return;
    const order = currentOrder();
    [order[from], order[to]] = [order[to], order[from]];
    setSelected(to);
    arrange(order);
  };

  const shuffle = () => {
    setConfirmShuffle(false);
    arrange(shuffled(currentOrder()));
  };

  const addPasted = async () => {
    const parsed = parsePasted(pasteText);
    if (parsed.length === 0) return;
    setBusy(true);
    const res = await fetch(`/api/admin/bingo/${event.id}/tiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fill", tiles: parsed }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNotice({ ok: false, text: json.error ?? "Couldn't add those tiles." });
    setNotice({
      ok: true,
      text: `Added ${json.added} ${json.added === 1 ? "tile" : "tiles"}.${json.full ? " The board filled up before the end of your list." : ""}${json.skipped?.length ? ` Skipped: ${json.skipped.join("; ")}` : ""}`,
    });
    setPasteText("");
    setShowPaste(false);
    await onChanged();
  };

  const totalPoints = tiles.reduce((s, t) => s + t.points, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start">
        <Card hover={false} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-bark-brown">
              <span className="font-semibold">
                {tiles.length} of {squares} squares set
              </span>
              <span className="text-iron-grey"> · {totalPoints} tile points</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setShowPaste((v) => !v)}>
                Paste a list
              </Button>
              {confirmShuffle ? (
                <>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={shuffle}>
                    Yes, shuffle
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmShuffle(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" disabled={busy || tiles.length < 2} onClick={() => setConfirmShuffle(true)}>
                  Shuffle
                </Button>
              )}
            </div>
          </div>

          {showPaste && (
            <div className="rounded-md border border-bark-brown-light/40 p-3 space-y-2">
              <p className="text-xs text-iron-grey">
                One tile per line, filling empty squares in order. Add <code className="font-mono">| points</code> and <code className="font-mono">| how many</code> if you like. Each becomes a screenshot tile you can adjust after.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                className={`${inputClass} font-mono`}
                placeholder={"Dragon warhammer | 3\nAbyssal whip | 2 | 2\nFire cape | 1\nTanzanite fang | 2"}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busy || !pasteText.trim()} onClick={addPasted}>
                  Add {parsePasted(pasteText).length || ""} tiles
                </Button>
                <span className="text-xs text-iron-grey">{squares - tiles.length} empty squares</span>
              </div>
            </div>
          )}

          <div className="grid gap-1.5 sm:gap-2 p-0.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {Array.from({ length: squares }, (_, p) => {
              const tile = byPos.get(p) ?? null;
              return (
                <TileFace
                  key={p}
                  tile={tile}
                  state={tile ? "open" : "empty"}
                  label={String(p + 1)}
                  selected={selected === p}
                  onClick={() => setSelected(p)}
                  draggable={!!tile && !busy}
                  onDragStart={(e) => {
                    setDragFrom(p);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (dragFrom != null) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFrom != null) swap(dragFrom, p);
                    setDragFrom(null);
                  }}
                />
              );
            })}
          </div>
          <p className="text-xs text-iron-grey">Click a square to edit it. Drag a tile onto another square to swap them. The number in the corner is its points.</p>
          {notice && <p className={`text-sm ${notice.ok ? "text-gnome-green" : "text-red-accent"}`}>{notice.text}</p>}
        </Card>

        <Card hover={false} className="lg:sticky lg:top-4">
          <TileEditor key={`${selected}:${byPos.get(selected)?.id ?? "new"}`} position={selected} tile={byPos.get(selected) ?? null} live={live} onSave={saveTile} onClear={clearTile} />
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onNext}>Next: sign-ups and teams</Button>
        {tiles.length < squares && <span className="text-sm text-iron-grey">You can come back and finish the board any time before it goes live.</span>}
      </div>
    </div>
  );
}
