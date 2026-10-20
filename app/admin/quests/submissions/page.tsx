"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { inputClass } from "@/components/admin/bingo/BasicsStep";
import { DIFFICULTY_COLOR, QUEST_BY_NAME, wikiUrl } from "@/lib/quests";

type Status = "pending" | "approved" | "rejected";

interface Submission {
  id: string;
  event_id: string;
  quest_name: string;
  image_urls: string[];
  note: string | null;
  source: "web" | "discord";
  status: Status;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  quest_events: { name: string } | null;
  quest_event_participants: { rsn: string; has_wikisync: boolean | null; quest_event_teams: { name: string; color: string | null } | null } | null;
}

const QUICK_REASONS = ["The quest was finished before the event started", "The quest complete scroll isn't visible", "Your name isn't visible", "That's a different quest"];

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function ReviewQueue() {
  const params = useSearchParams();
  const eventId = params.get("event");
  const [status, setStatus] = useState<Status>("pending");
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState<{ id: string | null; reason: string; rejecting: boolean }>({ id: null, reason: "", rejecting: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/quests/submissions?status=${status}${eventId ? `&eventId=${eventId}` : ""}`)
      .then((res) => res.json().then((json) => (res.ok ? json.submissions ?? [] : [])))
      .catch(() => [])
      .then((list) => !cancelled && setSubs(list));
    return () => {
      cancelled = true;
    };
  }, [status, eventId]);

  const current = subs?.[index] ?? null;
  const fresh = form.id !== (current?.id ?? null);
  const reason = fresh ? "" : form.reason;
  const rejecting = fresh ? false : form.rejecting;
  const patchForm = (patch: Partial<typeof form>) => setForm((f) => ({ ...(f.id === (current?.id ?? null) ? f : { id: current?.id ?? null, reason: "", rejecting: false }), ...patch }));

  const review = async (action: "approve" | "reject" | "reopen", sub: Submission | null = current) => {
    if (!sub) return;
    if (action === "reject" && !reason.trim()) return patchForm({ rejecting: true });
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/quests/submissions/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: reason }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Couldn't save the review.");
    setDone((d) => d + 1);
    const next = (subs ?? []).filter((s) => s.id !== sub.id);
    setSubs(next);
    setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
  };

  // Keyboard: A approve, S send back, J/K or arrows to move.
  useEffect(() => {
    if (status !== "pending") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || lightbox || busy) return;
      if (e.key === "a") review("approve");
      else if (e.key === "s") patchForm({ rejecting: true });
      else if (e.key === "j" || e.key === "ArrowRight") setIndex((i) => Math.min((subs?.length ?? 1) - 1, i + 1));
      else if (e.key === "k" || e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const quest = current ? QUEST_BY_NAME.get(current.quest_name) : undefined;
  const player = current?.quest_event_participants;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/quests" className="text-xs text-gnome-green hover:underline">← All quest events</Link>
          <h1 className="font-display text-3xl text-gnome-green">Quest screenshots</h1>
          <p className="text-bark-brown-light text-sm">
            {eventId && subs?.[0]?.quest_events ? `${subs[0].quest_events.name} only · ` : ""}
            {status === "pending" ? "Oldest first. Keys: A approve, S send back, J/K next and previous." : "Newest first."}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "primary" : "ghost"}
              onClick={() => {
                if (s === status) return;
                setSubs(null);
                setIndex(0);
                setStatus(s);
              }}
            >
              {s === "pending" ? "To review" : s === "approved" ? "Approved" : "Sent back"}
            </Button>
          ))}
        </div>
      </div>

      {subs === null ? (
        <p className="text-sm text-iron-grey">Loading...</p>
      ) : subs.length === 0 ? (
        <Card hover={false} className="text-center py-12">
          <p className="text-bark-brown">{status === "pending" ? (done > 0 ? `All caught up. You reviewed ${done}.` : "Nothing waiting for review.") : "Nothing here yet."}</p>
        </Card>
      ) : status === "pending" && current ? (
        <Card hover={false} className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-2 min-w-0">
            {current.image_urls.map((url) => (
              <button key={url} type="button" onClick={() => setLightbox(url)} className="block w-full cursor-zoom-in">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Proof from ${player?.rsn ?? "a player"}`} className="w-full max-h-[60vh] object-contain rounded-md border border-bark-brown-light/40 bg-black/5" />
              </button>
            ))}
          </div>
          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between text-xs text-iron-grey">
              <span>
                {index + 1} of {subs.length}
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Previous">
                  ←
                </Button>
                <Button size="sm" variant="ghost" disabled={index >= subs.length - 1} onClick={() => setIndex(index + 1)} aria-label="Next">
                  →
                </Button>
              </span>
            </div>
            <div>
              <h2 className="font-display text-2xl text-bark-brown leading-tight break-words">{current.quest_name}</h2>
              {quest && (
                <p className="text-xs text-iron-grey flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: DIFFICULTY_COLOR[quest.difficulty] }} aria-hidden />
                  {quest.difficulty} · {quest.qp} QP ·{" "}
                  <a href={wikiUrl(quest)} target="_blank" rel="noreferrer" className="text-gnome-green hover:underline">
                    Wiki ↗
                  </a>
                </p>
              )}
              <p className="text-xs text-iron-grey mt-0.5">{current.quest_events?.name}</p>
            </div>
            <div className="rounded-md bg-parchment-dark/40 p-3 text-sm space-y-1">
              <p>
                {player?.quest_event_teams && (
                  <>
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: player.quest_event_teams.color ?? "#999" }} />
                    <span className="font-semibold">{player.quest_event_teams.name}</span> ·{" "}
                  </>
                )}
                <span className="font-mono">{player?.rsn}</span>
              </p>
              <p className="text-xs text-iron-grey">
                Sent {ago(current.created_at)} from {current.source === "discord" ? "Discord" : "the website"}
                {player?.has_wikisync ? " · has WikiSync (it may still catch up on its own)" : " · no WikiSync"}
              </p>
              {current.note && <p className="text-sm italic text-bark-brown-light">&ldquo;{current.note}&rdquo;</p>}
            </div>

            {rejecting && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-bark-brown">Why is it being sent back?</p>
                <div className="flex flex-wrap gap-1">
                  {QUICK_REASONS.map((r) => (
                    <button key={r} type="button" onClick={() => patchForm({ reason: r })} className="text-xs px-2 py-1 rounded-full border border-bark-brown-light/40 hover:bg-parchment-dark cursor-pointer">
                      {r}
                    </button>
                  ))}
                </div>
                <textarea value={reason} onChange={(e) => patchForm({ reason: e.target.value })} rows={2} maxLength={500} className={inputClass} placeholder="The player sees this on the event page." autoFocus />
              </div>
            )}

            {error && <p className="text-sm text-red-accent">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => review("approve")}>
                Approve <span className="opacity-60 text-xs ml-1">A</span>
              </Button>
              <Button variant="secondary" disabled={busy || (rejecting && !reason.trim())} onClick={() => review("reject")}>
                {rejecting ? "Send back" : "Send back…"} <span className="opacity-60 text-xs ml-1">S</span>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {subs.map((s) => (
            <Card key={s.id} hover={false} className="flex flex-wrap items-center gap-3">
              {s.image_urls[0] && (
                <button type="button" onClick={() => setLightbox(s.image_urls[0])} className="cursor-zoom-in shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image_urls[0]} alt="" className="w-20 h-14 object-cover rounded" />
                </button>
              )}
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-semibold text-bark-brown truncate">
                  {s.quest_name} · {s.quest_event_participants?.rsn}
                </p>
                <p className="text-xs text-iron-grey">
                  {s.quest_events?.name} · {s.reviewed_by ? `by ${s.reviewed_by} ` : ""}
                  {s.reviewed_at ? ago(s.reviewed_at) : ""}
                  {s.review_note && ` · "${s.review_note}"`}
                </p>
              </div>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => review("reopen", s)}>
                Back to review
              </Button>
            </Card>
          ))}
        </div>
      )}

      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

export default function QuestSubmissionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-iron-grey">Loading...</p>}>
      <ReviewQueue />
    </Suspense>
  );
}
