"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { formatAmount, metricLabel, progressText, tileGoal, type BingoProgress, type BingoSubmission, type BingoTeam, type BingoTile } from "@/lib/bingo";
import { TileIcon } from "./TileFace";
import { ProofUploader } from "./ProofUploader";

const STATUS_PILL = {
  pending: "bg-gold/15 text-gold",
  approved: "bg-gnome-green/15 text-gnome-green",
  rejected: "bg-red-accent/10 text-red-accent",
} as const;
const STATUS_WORD = { pending: "Waiting on staff", approved: "Approved", rejected: "Sent back" } as const;

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

/**
 * Everything about one tile for one team: what counts, how far along the
 * team is, who helped, past submissions (with staff notes), and the
 * screenshot form when the viewer can submit.
 */
export function TileDrawer({
  eventId,
  tile,
  team,
  progress,
  submissions,
  canSubmit,
  lastSynced,
  onClose,
  onSubmitted,
}: {
  eventId: string;
  tile: BingoTile;
  team: BingoTeam | null;
  progress: BingoProgress | undefined;
  submissions: BingoSubmission[];
  canSubmit: boolean;
  lastSynced: string | null;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !lightbox && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, lightbox]);

  const value = progress?.progress ?? 0;
  const goal = tileGoal(tile);
  const done = !!progress?.completed_at;
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const pending = submissions.filter((s) => s.status === "pending");
  const remaining = Math.max(1, tile.required_count - value);
  const contributors = Object.entries(progress?.contributors ?? {}).sort((a, b) => b[1] - a[1]);
  const showForm = canSubmit && tile.kind === "proof" && !done && pending.reduce((n, s) => n + s.quantity, 0) < remaining;

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/bingo/${eventId}/tiles/${tile.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrls: images, quantity, note }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: json.error ?? "Couldn't send it." });
    setImages([]);
    setNote("");
    setQuantity(1);
    setMessage({ ok: true, text: "Sent! Staff will check it soon, and you'll see the result here." });
    await onSubmitted();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-labelledby="tile-drawer-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 cursor-default" />
      <div className="relative w-full sm:max-w-md max-h-[88vh] sm:max-h-none overflow-y-auto bg-parchment card-wood rounded-t-2xl sm:rounded-none sm:rounded-l-2xl p-5 space-y-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 shrink-0 rounded-lg bg-parchment-dark/60 flex items-center justify-center">
            <TileIcon tile={tile} className="w-10 h-10" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="tile-drawer-title" className="font-display text-2xl text-bark-brown leading-tight break-words">
              {tile.title}
            </h2>
            <p className="text-xs text-iron-grey mt-0.5">
              {tile.points} {tile.points === 1 ? "point" : "points"} ·{" "}
              {tile.kind === "auto"
                ? `Tracked by Wise Old Man · ${tile.auto_mode === "single_player" ? "one player must do it" : "whole team adds up"}`
                : tile.required_count > 1
                  ? `Screenshot proof · need ${tile.required_count}`
                  : "Screenshot proof"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-parchment-dark text-bark-brown cursor-pointer shrink-0">
            ✕
          </button>
        </div>

        {tile.description && <p className="text-sm text-bark-brown-light whitespace-pre-line">{tile.description}</p>}

        {tile.accepted_items.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-iron-grey mb-1.5">Any of these count</p>
            <ul className="grid grid-cols-2 gap-1.5">
              {tile.accepted_items.map((name) => (
                <li key={name} className="flex items-center gap-1.5 text-sm text-bark-brown min-w-0">
                  <TileIcon tile={{ icon_kind: "item", icon_ref: name, icon_item_id: null }} className="w-5 h-5 shrink-0" />
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={`rounded-lg p-3 ${done ? "bg-gnome-green/15" : "bg-parchment-dark/40"}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-bark-brown">{team ? team.name : "Progress"}</span>
            <span className={done ? "text-gnome-green font-bold" : "text-bark-brown tabular-nums"}>{done ? "✓ Done" : progressText(tile, value)}</span>
          </div>
          {!done && goal > 1 && (
            <div className="h-2 rounded-full bg-bark-brown-light/20 overflow-hidden mt-2">
              <div className="h-full bg-gnome-green rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
          {done && progress?.completed_at && <p className="text-xs text-iron-grey mt-1">Finished {ago(progress.completed_at)}</p>}
          {contributors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-bark-brown-light">
              {contributors.slice(0, 8).map(([rsn, amount]) => (
                <li key={rsn} className="flex justify-between gap-2">
                  <span className="font-mono truncate">{rsn}</span>
                  <span className="tabular-nums">{tile.kind === "auto" ? `+${formatAmount(Math.floor(amount))}` : `×${amount}`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {tile.kind === "auto" && !done && (
          <p className="text-xs text-iron-grey">
            This fills in by itself from {tile.metric ? metricLabel(tile.metric) : "Wise Old Man"} gains during the event
            {lastSynced ? ` (last checked ${ago(lastSynced)})` : ""}. If yours look behind, update your profile on Wise Old Man, or log out with the Wise Old Man RuneLite plugin on.
          </p>
        )}

        {submissions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-iron-grey mb-1.5">Your team&apos;s submissions</p>
            <ul className="space-y-2">
              {submissions.map((s) => (
                <li key={s.id} className="flex gap-2.5 text-sm">
                  {s.image_urls[0] && (
                    <button type="button" onClick={() => setLightbox(s.image_urls[0])} className="shrink-0 cursor-zoom-in">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.image_urls[0]} alt="" className="w-14 h-10 object-cover rounded" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <p>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_PILL[s.status]}`}>{STATUS_WORD[s.status]}</span>{" "}
                      <span className="text-bark-brown">{s.submitter_rsn}</span>
                      {s.quantity > 1 && <span className="text-iron-grey"> ×{s.quantity}</span>}
                      <span className="text-xs text-iron-grey"> · {ago(s.created_at)}</span>
                    </p>
                    {s.review_note && <p className="text-xs text-bark-brown-light mt-0.5">Staff: {s.review_note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showForm && (
          <div className="space-y-3 border-t border-bark-brown-light/30 pt-4">
            <p className="font-semibold text-bark-brown">Send proof</p>
            <ProofUploader images={images} onChange={setImages} />
            {tile.required_count > 1 && (
              <label className="flex items-center gap-2 text-sm text-bark-brown">
                How many does this show?
                <input
                  type="number"
                  min={1}
                  max={remaining}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(remaining, Number(e.target.value) || 1)))}
                  className="w-16 px-2 py-1 rounded-md border border-bark-brown-light bg-parchment text-sm"
                />
              </label>
            )}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Anything staff should know? (optional)"
              aria-label="Note for staff"
              className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm"
            />
            <Button className="w-full" disabled={busy || images.length === 0} onClick={submit}>
              {busy ? "Sending..." : "Send for review"}
            </Button>
            <p className="text-[11px] text-iron-grey text-center">You can also send proof from Discord with /bingo submit.</p>
          </div>
        )}
        {!showForm && canSubmit && tile.kind === "proof" && !done && pending.length > 0 && (
          <p className="text-sm text-gold">Your team&apos;s proof is waiting on staff. You&apos;ll see the result here.</p>
        )}
        {message && <p className={`text-sm ${message.ok ? "text-gnome-green" : "text-red-accent"}`}>{message.text}</p>}
      </div>
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
