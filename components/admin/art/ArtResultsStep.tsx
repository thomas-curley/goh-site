"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { AdminArt, AdminArtVote } from "./ArtBuilder";

export function ArtResultsStep({ data, onChanged }: { data: AdminArt; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const byId = new Map(data.entries.map((e) => [e.id, e]));
  const top = data.results[0]?.votes || 1;
  const comments = data.votes.filter((v) => v.comment);

  const act = async (v: AdminArtVote, method: "PATCH" | "DELETE") => {
    setBusy(v.id);
    await fetch(`/api/admin/art/${data.contest.id}/votes/${v.id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ comment_hidden: !v.comment_hidden }) : undefined,
    });
    setBusy(null);
    await onChanged();
  };

  return (
    <div className="space-y-5">
      <Card hover={false} className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl text-bark-brown">Standings</h2>
          <span className="text-xs text-iron-grey">
            {data.votes.length} votes from {data.voterCount} {data.voterCount === 1 ? "voter" : "voters"}
            {!data.contest.show_live_results && data.contest.status === "voting" && " · hidden from members until you finish"}
          </span>
        </div>
        {data.results.length === 0 ? (
          <p className="text-sm text-iron-grey">No approved entries yet.</p>
        ) : (
          <ol className="divide-y divide-bark-brown-light/20">
            {data.results.map((r) => {
              const e = byId.get(r.entryId);
              if (!e) return null;
              return (
                <li key={r.entryId} className="py-2 flex items-center gap-3">
                  <span className="w-7 text-center font-display text-lg text-iron-grey">{r.votes > 0 && r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                  {e.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.images[0]} alt="" className="w-14 h-14 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-bark-brown truncate">{e.title}</span>
                      <span className="text-sm tabular-nums text-bark-brown shrink-0">{r.votes}</span>
                    </div>
                    <p className="text-xs text-iron-grey">{e.shownAs}</p>
                    <div className="h-1.5 rounded-full bg-bark-brown-light/15 overflow-hidden mt-1">
                      <div className="h-full rounded-full bg-gnome-green" style={{ width: `${(r.votes / top) * 100}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card hover={false} className="space-y-3">
        <h2 className="font-display text-xl text-bark-brown">Comments ({comments.length})</h2>
        <p className="text-xs text-iron-grey">Hide a comment to keep it off the site (the vote still counts), or remove the vote entirely if it broke the rules.</p>
        {comments.length === 0 ? (
          <p className="text-sm text-iron-grey">No comments yet.</p>
        ) : (
          <ul className="divide-y divide-bark-brown-light/20">
            {comments.map((v) => (
              <li key={v.id} className={`py-2.5 space-y-1 ${v.comment_hidden ? "opacity-60" : ""}`}>
                <p className="text-sm text-bark-brown">&ldquo;{v.comment}&rdquo;</p>
                <p className="text-xs text-iron-grey">
                  {v.voter_name ?? "Anonymous voter"} on <span className="font-semibold">{byId.get(v.entry_id)?.title ?? "an entry"}</span> · {new Date(v.created_at).toLocaleString()}
                  {v.comment_hidden && " · hidden"}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={busy === v.id} onClick={() => act(v, "PATCH")}>
                    {v.comment_hidden ? "Show comment" : "Hide comment"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-accent" disabled={busy === v.id} onClick={() => act(v, "DELETE")}>
                    Remove vote
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
