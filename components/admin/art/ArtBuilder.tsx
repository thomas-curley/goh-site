"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CONTEST_STATUS_LABELS, type ArtContest, type ArtContestStatus, type ArtEntry, type EntryResult } from "@/lib/art";
import { ArtSetupStep } from "./ArtSetupStep";
import { ArtEntriesStep } from "./ArtEntriesStep";
import { ArtResultsStep } from "./ArtResultsStep";

export interface AdminArtEntry extends ArtEntry {
  images: string[];
  shownAs: string;
}
export interface AdminArtVote {
  id: string;
  entry_id: string;
  voter_key: string;
  voter_name: string | null;
  comment: string | null;
  comment_hidden: boolean;
  created_at: string;
}
export interface AdminArt {
  contest: ArtContest;
  entries: AdminArtEntry[];
  votes: AdminArtVote[];
  results: EntryResult[];
  voterCount: number;
}

export const ART_STATUS_CHIP: Record<ArtContestStatus, string> = {
  draft: "bg-iron-grey/15 text-iron-grey",
  submissions: "bg-gold/15 text-gold",
  review: "bg-sky-600/15 text-sky-700",
  voting: "bg-gnome-green/15 text-gnome-green",
  completed: "bg-bark-brown/10 text-bark-brown",
};

const FLOW: { status: ArtContestStatus; label: string; next?: string; nextLabel?: string }[] = [
  { status: "draft", label: "Draft", next: "submissions", nextLabel: "Open entries" },
  { status: "submissions", label: "Entries open", next: "review", nextLabel: "Close entries" },
  { status: "review", label: "Judging", next: "voting", nextLabel: "Open voting" },
  { status: "voting", label: "Voting", next: "completed", nextLabel: "Finish and show results" },
  { status: "completed", label: "Finished" },
];

const TABS = [
  { key: "setup", label: "Setup" },
  { key: "entries", label: "Entries" },
  { key: "results", label: "Votes & comments" },
] as const;
type Tab = (typeof TABS)[number]["key"];

async function fetchContest(id: string) {
  const res = await fetch(`/api/admin/art/${id}`);
  return { ok: res.ok, json: await res.json().catch(() => ({})) };
}

/** The staff side of one art contest: its stage, setup, entry review and results. */
export function ArtBuilder({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<AdminArt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("setup");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const opened = useRef(false);

  const apply = useCallback((res: { ok: boolean; json: AdminArt & { error?: string } }) => {
    if (!res.ok) return setError(res.json.error ?? "Couldn't load this contest.");
    setData(res.json);
    if (opened.current) return;
    opened.current = true;
    const s = res.json.contest.status;
    if (s === "review" || (s === "submissions" && res.json.entries.some((e) => e.status === "pending"))) setTab("entries");
    else if (s === "voting" || s === "completed") setTab("results");
  }, []);
  const reload = useCallback(async () => apply(await fetchContest(id)), [id, apply]);

  useEffect(() => {
    let cancelled = false;
    fetchContest(id).then((res) => !cancelled && apply(res));
    return () => {
      cancelled = true;
    };
  }, [id, apply]);

  if (!data) return <p className="text-sm text-iron-grey py-10 text-center">{error ?? "Loading..."}</p>;
  const { contest, entries } = data;
  const stage = FLOW.findIndex((f) => f.status === contest.status);
  const current = FLOW[stage];
  const pending = entries.filter((e) => e.status === "pending").length;
  const approved = entries.filter((e) => e.status === "approved").length;

  const move = async (status: string, announce = false) => {
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/admin/art/${contest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, announce }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return setNotice({ ok: false, text: json.error ?? "Couldn't change the stage." });
    setNotice({ ok: true, text: `Now: ${CONTEST_STATUS_LABELS[status as ArtContestStatus]}.` });
    await reload();
  };

  const remove = async () => {
    setBusy(true);
    const res = await fetch(`/api/admin/art/${contest.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.push("/admin/art");
    else setNotice({ ok: false, text: "Couldn't delete it." });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/art" className="text-xs text-gnome-green hover:underline">← All art contests</Link>
          <h1 className="font-display text-3xl text-gnome-green break-words">{contest.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${ART_STATUS_CHIP[contest.status]}`}>{CONTEST_STATUS_LABELS[contest.status]}</span>
            <span className="text-iron-grey">
              {entries.filter((e) => e.status !== "withdrawn").length} entries · {approved} approved · {data.voterCount} voters
            </span>
            {pending > 0 && (
              <button type="button" onClick={() => setTab("entries")} className="px-2 py-0.5 rounded-full bg-gold/15 text-gold font-semibold hover:underline cursor-pointer">
                {pending} to review
              </button>
            )}
          </div>
        </div>
        <Link href={`/art/${contest.id}`} target="_blank" className="text-sm text-gnome-green hover:underline shrink-0">
          {contest.status === "draft" ? "Preview as a member ↗" : "Open member page ↗"}
        </Link>
      </div>

      {/* Stage */}
      <div className="card-wood rounded-lg p-4 space-y-3">
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {FLOW.map((f, i) => (
            <li key={f.status} className="flex items-center gap-1">
              <span className={`px-2.5 py-1 rounded-full ${i === stage ? "bg-gnome-green text-text-light font-semibold" : i < stage ? "bg-gnome-green/10 text-gnome-green" : "bg-parchment-dark text-iron-grey"}`}>
                {i < stage ? "✓ " : ""}
                {f.label}
              </span>
              {i < FLOW.length - 1 && <span className="text-iron-grey">→</span>}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          {current?.next &&
            (confirm === current.next ? (
              <>
                <span className="text-sm text-bark-brown">
                  {current.next === "voting"
                    ? `Open voting on ${approved} approved ${approved === 1 ? "entry" : "entries"}?`
                    : current.next === "completed"
                      ? "Close voting and show the results?"
                      : current.next === "review"
                        ? "Stop taking entries?"
                        : "Open the contest for entries?"}
                </span>
                <Button size="sm" disabled={busy} onClick={() => move(current.next!)}>
                  Yes
                </Button>
                {current.next !== "review" && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => move(current.next!, true)}>
                    Yes, and post it in Discord
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" disabled={busy || (current.next === "voting" && approved === 0)} onClick={() => setConfirm(current.next!)}>
                {current.nextLabel}
              </Button>
            ))}
          {stage > 0 && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => move(FLOW[stage - 1].status, false)}>
              Back to {FLOW[stage - 1].label.toLowerCase()}
            </Button>
          )}
          {current?.next === "voting" && approved === 0 && <span className="text-xs text-iron-grey">Approve at least one entry first.</span>}
          {notice && <span className={`text-sm ${notice.ok ? "text-gnome-green" : "text-red-accent"}`}>{notice.text}</span>}
        </div>
        <p className="text-[11px] text-iron-grey">Nothing is posted to Discord unless you pick &quot;post it in Discord&quot; (it goes to the Art Contest Announcements channel in Admin › Discord Channels).</p>
      </div>

      <nav className="flex gap-1 border-b border-bark-brown-light/30" aria-label="Contest sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`px-3.5 py-2 text-sm cursor-pointer border-b-2 -mb-px ${tab === t.key ? "border-gnome-green text-gnome-green font-semibold" : "border-transparent text-bark-brown-light hover:text-bark-brown"}`}
          >
            {t.label}
            {t.key === "entries" && pending > 0 && <span className="ml-1.5 rounded-full bg-gold/20 text-gold px-1.5 text-xs">{pending}</span>}
          </button>
        ))}
      </nav>

      {tab === "setup" && <ArtSetupStep key={contest.updated_at} contest={contest} onSaved={reload} />}
      {tab === "entries" && <ArtEntriesStep data={data} onChanged={reload} />}
      {tab === "results" && <ArtResultsStep data={data} onChanged={reload} />}

      <div className="pt-4 border-t border-bark-brown-light/20">
        {confirm === "delete" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-red-accent">This deletes the contest, every entry and image, and all votes, for good.</span>
            <Button size="sm" variant="ghost" className="text-red-accent" disabled={busy} onClick={remove}>
              Delete {contest.name}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm("delete")} className="text-xs text-red-accent hover:underline cursor-pointer">
            Delete this contest
          </button>
        )}
      </div>
    </div>
  );
}
