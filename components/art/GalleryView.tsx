"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface Piece {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  artist: string;
  contest: { id: string; name: string; theme: string | null } | null;
  clanOnly: boolean;
}

/** The Gn0mie Gallery: contest pieces whose artists chose to show them off. */
export function GalleryView() {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [contests, setContests] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [page, setPage] = useState(1);
  const [contest, setContest] = useState("");
  const [open, setOpen] = useState<Piece | null>(null);
  const [image, setImage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/gallery?page=${page}${contest ? `&contest=${contest}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setPieces(d.pieces ?? []);
        setContests(d.contests ?? []);
        setTotal(d.total ?? 0);
        setPageSize(d.pageSize ?? 24);
      })
      .catch(() => !cancelled && setPieces([]));
    return () => {
      cancelled = true;
    };
  }, [page, contest]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl text-gnome-green">Gn0mie Gallery</h1>
          <p className="text-bark-brown-light mt-1 max-w-2xl">Artwork by members of the clan, from our art contests. Every piece here is shown with its artist&apos;s permission.</p>
        </div>
        {contests.length > 1 && (
          <select
            value={contest}
            onChange={(e) => {
              setContest(e.target.value);
              setPage(1);
            }}
            aria-label="Contest"
            className="px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm cursor-pointer"
          >
            <option value="">Every contest</option>
            {contests.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {pieces === null ? (
        <p className="text-sm text-iron-grey">Loading...</p>
      ) : pieces.length === 0 ? (
        <div className="card-wood rounded-xl text-center py-16">
          <p className="text-bark-brown">Nothing on the walls yet.</p>
          <p className="text-sm text-iron-grey mt-1">Pieces appear here once an art contest finishes.</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [&>*]:mb-4">
          {pieces.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setOpen(p);
                setImage(0);
              }}
              className="group block w-full text-left break-inside-avoid card-wood rounded-xl overflow-hidden cursor-pointer"
            >
              {p.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0]} alt={p.title} className="w-full h-auto transition-transform group-hover:scale-[1.02]" loading="lazy" />
              )}
              <div className="p-3">
                <p className="font-semibold text-bark-brown">{p.title}</p>
                <p className="text-xs text-iron-grey">
                  by {p.artist}
                  {p.contest ? ` · ${p.contest.name}` : ""}
                  {p.clanOnly ? " · clan only" : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Previous
          </Button>
          <span className="text-sm text-iron-grey">
            Page {page} of {pages}
          </span>
          <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next →
          </Button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 bg-black/70 overflow-y-auto" onClick={() => setOpen(null)}>
          <div role="dialog" aria-modal="true" aria-label={open.title} onClick={(e) => e.stopPropagation()} className="card-wood rounded-xl w-full max-w-4xl my-8 overflow-hidden shadow-2xl">
            {open.images[image] && (
              <button type="button" onClick={() => setImage((image + 1) % open.images.length)} className="block w-full bg-black/40 cursor-pointer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={open.images[image]} alt={open.title} className="w-full max-h-[70vh] object-contain" />
              </button>
            )}
            <div className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-gnome-green">{open.title}</h2>
                  <p className="text-sm text-iron-grey">
                    by {open.artist}
                    {open.contest && (
                      <>
                        {" · "}
                        <Link href={`/art/${open.contest.id}`} className="text-gnome-green hover:underline">
                          {open.contest.name}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="text-2xl leading-none text-iron-grey hover:text-bark-brown cursor-pointer">
                  ×
                </button>
              </div>
              {open.description && <p className="text-sm text-bark-brown-light whitespace-pre-line">{open.description}</p>}
              {open.images.length > 1 && <p className="text-xs text-iron-grey">Image {image + 1} of {open.images.length}. Click the picture for the next one.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
