"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { editionLabel, formatEditionDate, type HandbookContentsEntry, type HandbookEditionView } from "@/lib/handbook-format";

interface EditionLink {
  id: string;
  title: string;
  version_label: string | null;
  published_at: string | null;
}

const pill =
  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-bark-brown-light/60 bg-parchment text-sm text-bark-brown hover:bg-parchment-dark hover:text-gnome-green transition-colors cursor-pointer";
const toolbarButton =
  "w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg text-bark-brown hover:bg-parchment-dark disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer";

/** The contents entry a page falls under: the last one starting at or before it. */
function chapterFor(contents: HandbookContentsEntry[], page: number): HandbookContentsEntry | null {
  let found: HandbookContentsEntry | null = null;
  for (const entry of contents) {
    if (entry.page <= page) found = entry;
    else break;
  }
  return found;
}

function storageKey(editionId: string) {
  return `handbook-last-page:${editionId}`;
}

/**
 * The Staff Handbook: uploaded page images read top to bottom, with a
 * contents sidebar (a drawer on phones), a page toolbar pinned to the
 * bottom of the screen, arrow-key paging, page links (#page-12), tap to
 * zoom, and "continue where you left off".
 */
export function HandbookReader({
  edition,
  editions,
  isCurrent,
}: {
  edition: HandbookEditionView;
  editions: EditionLink[];
  isCurrent: boolean;
}) {
  const pageCount = edition.page_urls.length;
  const contents = edition.contents;
  const [page, setPage] = useState(1);
  const [zoomed, setZoomed] = useState<number | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [resumePage, setResumePage] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const readyRef = useRef(false);

  const goTo = useCallback((n: number, behavior: ScrollBehavior = "smooth") => {
    const target = Math.min(pageCount, Math.max(1, n));
    pageRefs.current[target - 1]?.scrollIntoView({ behavior, block: "start" });
    setContentsOpen(false);
  }, [pageCount]);

  // On arrival: jump to a linked page, or offer to resume where this
  // reader left off. Runs before the effects below start rewriting the
  // address bar and the saved position.
  useEffect(() => {
    const linked = /^#page-(\d+)$/.exec(window.location.hash);
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(storageKey(edition.id)));
    } catch {
      saved = 0;
    }
    const frame = requestAnimationFrame(() => {
      if (linked) goTo(Number(linked[1]), "auto");
      else if (saved > 1 && saved <= pageCount) setResumePage(saved);
      readyRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [edition.id, pageCount, goTo]);

  // Track the page in view: the topmost page whose top has scrolled past a
  // line a third of the way down the screen.
  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight / 3;
      let current = 1;
      pageRefs.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= line) current = i + 1;
      });
      setPage(current);
    };
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Keep the address bar's #page-n and the saved reading position in step.
  useEffect(() => {
    if (!readyRef.current) return;
    if (page > 1) window.history.replaceState(null, "", `#page-${page}`);
    else if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    try {
      localStorage.setItem(storageKey(edition.id), String(page));
    } catch {
      // Storage unavailable (private mode) -- resuming just won't be offered.
    }
  }, [page, edition.id]);

  // Arrow keys / PageUp / PageDown move a whole page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (zoomed !== null || target?.closest("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goTo(page + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTo(page - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, zoomed, goTo]);

  const copyPageLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#page-${page}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const chapter = chapterFor(contents, page);
  const otherEditions = editions.filter((e) => e.id !== edition.id);

  const contentsList = (
    <ContentsList contents={contents} pageCount={pageCount} page={page} activeChapter={chapter} onPick={goTo} />
  );

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6 pt-6 sm:pt-10 pb-28">
      <header className="mb-6 text-center lg:text-left lg:pl-[264px]">
        <p className="text-xs uppercase tracking-[0.2em] text-iron-grey">
          Gn0me Home
          {!isCurrent && <span className="ml-2 px-2 py-0.5 rounded-full bg-red-accent/15 text-red-accent normal-case tracking-normal">Older edition</span>}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-gnome-green mt-1">{edition.title}</h1>
        <p className="text-sm text-bark-brown-light mt-1">
          {[edition.version_label, edition.published_at && `Updated ${formatEditionDate(edition.published_at)}`, `${pageCount} page${pageCount === 1 ? "" : "s"}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {edition.notes && <p className="mt-2 text-sm italic text-bark-brown max-w-2xl lg:mx-0 mx-auto">{edition.notes}</p>}
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-4">
          {edition.pdf_url && (
            <a href={edition.pdf_url} target="_blank" rel="noreferrer" className={pill}>📄 Download PDF</a>
          )}
          <button type="button" onClick={copyPageLink} className={pill}>
            🔗 {copied ? "Link copied!" : `Copy link to page ${page}`}
          </button>
          {!isCurrent && (
            <Link href="/staff-handbook" className={pill}>Go to the current edition →</Link>
          )}
        </div>
      </header>

      {resumePage && page === 1 && (
        <div className="mb-4 lg:ml-[264px] flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gnome-green/40 bg-gnome-green/10 px-4 py-2 text-sm text-bark-brown">
          <span>You were on page {resumePage}.</span>
          <span className="flex gap-3">
            <button type="button" onClick={() => { goTo(resumePage); setResumePage(null); }} className="font-semibold text-gnome-green hover:underline cursor-pointer">
              Continue reading →
            </button>
            <button type="button" onClick={() => setResumePage(null)} className="text-iron-grey hover:underline cursor-pointer">Dismiss</button>
          </span>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border border-bark-brown-light/40 bg-parchment/70 p-3">
            {contentsList}
          </div>
        </aside>

        <div className="space-y-6 min-w-0">
          {edition.page_urls.map((url, i) => (
            <figure key={i} id={`page-${i + 1}`} ref={(el) => { pageRefs.current[i] = el; }} className="scroll-mt-20">
              <button type="button" onClick={() => setZoomed(i)} className="block w-full cursor-pointer" title="Tap to zoom">
                {/* Plain <img>: signed links to full-page images of unknown size in a private bucket. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${edition.title}, page ${i + 1} of ${pageCount}`}
                  loading={i < 2 ? "eager" : "lazy"}
                  className="w-full h-auto rounded-md border border-bark-brown-light/40 shadow-md bg-white"
                />
              </button>
              <figcaption className="mt-2 text-center text-xs text-iron-grey">Page {i + 1} of {pageCount}</figcaption>
            </figure>
          ))}

          {otherEditions.length > 0 && (
            <section className="pt-8 border-t border-bark-brown-light/40" aria-labelledby="editions-heading">
              <h2 id="editions-heading" className="font-display text-xl text-bark-brown mb-3">Other editions</h2>
              <ul className="space-y-1.5 text-sm">
                {otherEditions.map((e) => (
                  <li key={e.id}>
                    <Link href={e.id === editions[0]?.id ? "/staff-handbook" : `/staff-handbook?edition=${e.id}`} className="text-gnome-green hover:underline">
                      {editionLabel(e)}
                    </Link>
                    <span className="text-iron-grey"> · {formatEditionDate(e.published_at)}{e.id === editions[0]?.id ? " · current" : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* Page toolbar, pinned to the bottom of the screen. */}
      <div className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-bark-brown-light/60 bg-parchment/95 backdrop-blur shadow-lg px-1.5 py-1 max-w-full">
          <button type="button" onClick={() => goTo(page - 1)} disabled={page <= 1} className={toolbarButton} aria-label="Previous page">‹</button>
          <button
            type="button"
            onClick={() => setContentsOpen(true)}
            className="lg:pointer-events-none min-w-0 px-2 text-center cursor-pointer lg:cursor-default"
            aria-label="Open contents"
          >
            <span className="block text-sm font-semibold text-bark-brown whitespace-nowrap">Page {page} of {pageCount}</span>
            {chapter && <span className="block text-xs text-iron-grey truncate max-w-[180px] sm:max-w-[280px]">{chapter.title}</span>}
          </button>
          <button type="button" onClick={() => goTo(page + 1)} disabled={page >= pageCount} className={toolbarButton} aria-label="Next page">›</button>
        </div>
      </div>

      {/* Contents drawer for phones/tablets. */}
      {contentsOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setContentsOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-parchment p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-display text-lg text-gnome-green">Contents</p>
              <button type="button" onClick={() => setContentsOpen(false)} className="text-iron-grey hover:text-bark-brown cursor-pointer px-2" aria-label="Close contents">✕</button>
            </div>
            {contentsList}
          </div>
        </div>
      )}

      {zoomed !== null && (
        <ImageLightbox src={edition.page_urls[zoomed]} alt={`Page ${zoomed + 1}`} onClose={() => setZoomed(null)} />
      )}
    </div>
  );
}

function ContentsList({
  contents,
  pageCount,
  page,
  activeChapter,
  onPick,
}: {
  contents: HandbookContentsEntry[];
  pageCount: number;
  page: number;
  activeChapter: HandbookContentsEntry | null;
  onPick: (page: number) => void;
}) {
  const [jump, setJump] = useState("");

  return (
    <div className="space-y-3">
      {contents.length > 0 && (
        <nav aria-label="Contents">
          <p className="hidden lg:block text-xs font-semibold uppercase tracking-wide text-iron-grey mb-1.5">Contents</p>
          <ol className="space-y-0.5">
            {contents.map((entry) => {
              const active = entry === activeChapter;
              return (
                <li key={`${entry.page}-${entry.title}`}>
                  <button
                    type="button"
                    onClick={() => onPick(entry.page)}
                    aria-current={active ? "true" : undefined}
                    className={`w-full flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors cursor-pointer ${
                      active ? "bg-gnome-green/15 text-gnome-green font-semibold" : "text-bark-brown hover:bg-parchment-dark"
                    }`}
                  >
                    <span className="min-w-0">{entry.title}</span>
                    <span className="text-xs text-iron-grey shrink-0">{entry.page}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-iron-grey mb-1.5">Pages</p>
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPick(n)}
              aria-current={n === page ? "page" : undefined}
              className={`rounded py-1 text-xs cursor-pointer transition-colors ${
                n === page ? "bg-gnome-green text-white font-semibold" : "text-bark-brown hover:bg-parchment-dark"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {pageCount > 24 && (
          <form
            className="flex gap-1 mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(jump);
              if (Number.isInteger(n)) onPick(n);
              setJump("");
            }}
          >
            <input
              type="number"
              min={1}
              max={pageCount}
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              placeholder="Go to page"
              aria-label="Go to page"
              className="w-full min-w-0 px-2 py-1 rounded-md border border-bark-brown-light bg-parchment text-sm"
            />
            <button type="submit" className="px-2 rounded-md bg-gnome-green text-white text-xs font-semibold cursor-pointer">Go</button>
          </form>
        )}
      </div>
    </div>
  );
}
