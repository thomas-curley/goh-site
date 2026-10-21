"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { DiscordInline, DiscordText } from "@/components/discord/DiscordText";
import type { DiscordNames } from "@/lib/discord-names";

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  author_name: string | null;
  created_at: string;
}

type Names = Pick<DiscordNames, "channels" | "roles" | "users">;

function Meta({ a }: { a: NewsItem }) {
  return (
    <div className="flex items-center gap-2 text-xs text-iron-grey">
      {a.pinned && <span title="Pinned">📌</span>}
      <span className="uppercase tracking-wide">{a.category.replace(/_/g, " ")}</span>
      <span>·</span>
      <span>{new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
    </div>
  );
}

/** The homepage's Latest News: Discord-formatted previews that open the full post. */
export function NewsList({ items, names }: { items: NewsItem[]; names: Names }) {
  const [open, setOpen] = useState<NewsItem | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {items.map((a) => (
        <button key={a.id} type="button" onClick={() => setOpen(a)} className="block w-full text-left cursor-pointer group">
          <Card className="group-hover:border-gnome-green/50 transition-colors">
            <Meta a={a} />
            <h3 className="font-display text-lg text-bark-brown mt-1">
              <DiscordInline text={a.title} names={names} />
            </h3>
            <p className="text-sm text-bark-brown-light mt-2 line-clamp-3">
              <DiscordInline text={a.content} names={names} />
            </p>
            <div className="flex items-center justify-between gap-2 mt-2 text-xs">
              <span className="text-iron-grey">{a.author_name ? `— ${a.author_name}` : ""}</span>
              <span className="text-gnome-green font-semibold group-hover:underline">Read more →</span>
            </div>
          </Card>
        </button>
      ))}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-title"
            onClick={(e) => e.stopPropagation()}
            className="card-wood rounded-xl w-full max-w-2xl my-8 p-5 sm:p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Meta a={open} />
                <h2 id="news-title" className="font-display text-2xl text-gnome-green mt-1 break-words">
                  <DiscordInline text={open.title} names={names} />
                </h2>
                {open.author_name && <p className="text-xs text-iron-grey mt-0.5">by {open.author_name}</p>}
              </div>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="shrink-0 text-2xl leading-none text-iron-grey hover:text-bark-brown cursor-pointer px-1">
                ×
              </button>
            </div>
            <div className="mt-4 text-sm text-bark-brown leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              <DiscordText text={open.content} names={names} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
