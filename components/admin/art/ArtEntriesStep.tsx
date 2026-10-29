"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { inputClass } from "@/components/admin/bingo/BasicsStep";
import { ENTRY_STATUS_LABELS, type ArtEntryStatus } from "@/lib/art";
import type { AdminArt, AdminArtEntry } from "./ArtBuilder";

const QUICK_REASONS = ["This doesn't follow the contest theme", "It looks AI-generated; original work only", "Not clan-friendly", "The image didn't come through clearly; please re-upload"];
const FILTERS: (ArtEntryStatus | "all")[] = ["pending", "approved", "rejected", "withdrawn", "all"];

function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "warn" }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${tone === "warn" ? "bg-gold/15 text-gold" : "bg-parchment-dark text-bark-brown"}`}>{children}</span>;
}

export function ArtEntriesStep({ data, onChanged }: { data: AdminArt; onChanged: () => Promise<void> }) {
  const [filter, setFilter] = useState<ArtEntryStatus | "all">(data.entries.some((e) => e.status === "pending") ? "pending" : "approved");
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const shown = data.entries.filter((e) => filter === "all" || e.status === filter);
  const count = (s: ArtEntryStatus | "all") => (s === "all" ? data.entries.length : data.entries.filter((e) => e.status === s).length);

  const act = async (entry: AdminArtEntry, body: Record<string, unknown>, method = "PATCH") => {
    setBusy(entry.id);
    setError(null);
    const res = await fetch(`/api/admin/art/${data.contest.id}/entries/${entry.id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(json.error ?? "Couldn't save.");
    setRejecting(null);
    setDeleting(null);
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-sm cursor-pointer ${filter === f ? "bg-gnome-green text-text-light font-semibold" : "bg-parchment-dark text-bark-brown"}`}>
            {f === "all" ? "All" : ENTRY_STATUS_LABELS[f]} ({count(f)})
          </button>
        ))}
      </div>
      <p className="text-xs text-iron-grey">Approve the pieces that follow the rules; only approved entries go to the vote. Sent-back entries show your reason to the artist, who can fix and resubmit while entries are open.</p>
      {error && <p className="text-sm text-red-accent">{error}</p>}

      {shown.length === 0 ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-sm text-iron-grey">Nothing here.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((e) => (
            <Card key={e.id} hover={false} className="space-y-3">
              <div className={`grid gap-1.5 ${e.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {e.images.map((url, i) => (
                  <button key={url} type="button" onClick={() => setLightbox(url)} className={`block cursor-zoom-in rounded-md overflow-hidden bg-black/5 ${i === 0 && e.images.length === 3 ? "col-span-2" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`${e.title} (${i + 1})`} className="w-full max-h-72 object-contain" />
                  </button>
                ))}
                {e.images.length === 0 && <p className="text-xs text-iron-grey">No images (withdrawn).</p>}
              </div>
              <div>
                <h3 className="font-display text-xl text-bark-brown break-words">{e.title}</h3>
                <p className="text-xs text-iron-grey">
                  By <span className="font-mono">{e.rsn ?? "no linked RSN"}</span> · shown as <span className="font-semibold">{e.shownAs}</span> · {new Date(e.created_at).toLocaleDateString()}
                </p>
                {e.description && <p className="text-sm text-bark-brown-light mt-1 whitespace-pre-line">{e.description}</p>}
              </div>
              <div className="flex flex-wrap gap-1">
                <Chip tone={e.visibility === "clan" ? "warn" : "plain"}>{e.visibility === "clan" ? "Clan members only" : "Public"}</Chip>
                <Chip>{e.gallery_opt_in ? "OK for the gallery" : "Not in the gallery"}</Chip>
                {e.gallery_hidden && <Chip tone="warn">Hidden from gallery by staff</Chip>}
                {!e.agreed_rules && <Chip tone="warn">Didn&apos;t confirm the rules</Chip>}
                <Chip>{ENTRY_STATUS_LABELS[e.status]}</Chip>
              </div>
              {e.review_note && <p className="text-xs text-bark-brown-light">Note: {e.review_note}{e.reviewed_by ? ` (${e.reviewed_by})` : ""}</p>}

              {rejecting?.id === e.id ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {QUICK_REASONS.map((r) => (
                      <button key={r} type="button" onClick={() => setRejecting({ id: e.id, note: r })} className="text-xs px-2 py-1 rounded-full border border-bark-brown-light/40 hover:bg-parchment-dark cursor-pointer">
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea value={rejecting.note} onChange={(ev) => setRejecting({ id: e.id, note: ev.target.value })} rows={2} maxLength={500} className={inputClass} placeholder="The artist sees this." autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={busy === e.id || !rejecting.note.trim()} onClick={() => act(e, { action: "reject", note: rejecting.note })}>
                      Send back
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {e.status !== "approved" && e.status !== "withdrawn" && (
                    <Button size="sm" disabled={busy === e.id} onClick={() => act(e, { action: "approve" })}>
                      Approve for voting
                    </Button>
                  )}
                  {e.status !== "rejected" && e.status !== "withdrawn" && (
                    <Button size="sm" variant="secondary" disabled={busy === e.id} onClick={() => setRejecting({ id: e.id, note: "" })}>
                      Send back…
                    </Button>
                  )}
                  {(e.status === "approved" || e.status === "rejected") && (
                    <Button size="sm" variant="ghost" disabled={busy === e.id} onClick={() => act(e, { action: "reopen" })}>
                      Back to review
                    </Button>
                  )}
                  {e.status === "approved" && e.gallery_opt_in && (
                    <Button size="sm" variant="ghost" disabled={busy === e.id} onClick={() => act(e, { gallery_hidden: !e.gallery_hidden })}>
                      {e.gallery_hidden ? "Allow in gallery" : "Hide from gallery"}
                    </Button>
                  )}
                  {deleting === e.id ? (
                    <>
                      <Button size="sm" variant="ghost" className="text-red-accent" disabled={busy === e.id} onClick={() => act(e, {}, "DELETE")}>
                        Yes, delete it
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setDeleting(e.id)} className="text-xs text-red-accent hover:underline cursor-pointer ml-auto">
                      Delete
                    </button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
