"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Submission {
  tile_id: string;
  team_id: string;
  status: "incomplete" | "pending_review" | "completed";
  image_urls: string[] | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  tile_title: string;
  tile_description: string | null;
  team_name: string;
}

type Tab = "pending" | "completed" | "all";

function submissionState(s: Submission): "pending" | "completed" | "rejected" {
  if (s.status === "completed") return "completed";
  if (s.status === "pending_review") return "pending";
  return "rejected";
}

export default function BingoReviewPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [tab, setTab] = useState<Tab>("pending");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/bingo/${eventId}/submissions`);
    const data = await res.json().catch(() => ({}));
    setSubmissions(res.ok ? data.submissions ?? [] : []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const visible = submissions.filter((s) => {
    const state = submissionState(s);
    if (tab === "pending") return state === "pending";
    if (tab === "completed") return state === "completed";
    return true;
  });

  const review = async (s: Submission, status: "completed" | "incomplete") => {
    const key = `${s.tile_id}:${s.team_id}`;
    setBusyKey(key);
    setActionStatus(null);
    const res = await fetch(`/api/admin/bingo/${eventId}/tiles/${s.tile_id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: s.team_id, status, reviewNotes: notesDraft[key] ?? "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setActionStatus(`${status === "completed" ? "Approved" : "Rejected"} ${s.tile_title} for ${s.team_name}.`);
      await load();
    } else {
      setActionStatus(data.error ?? "Failed to update. Try again.");
    }
    setBusyKey(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="font-display text-3xl text-gnome-green">Review Submissions</h1>
        <Link href={`/admin/bingo/${eventId}/edit`} className="text-sm text-gnome-green hover:underline shrink-0">← Back to Event</Link>
      </div>
      <p className="text-bark-brown-light mb-6">Approve or reject manual tile screenshots submitted by teams.</p>

      {actionStatus && <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{actionStatus}</div>}

      <div className="flex flex-wrap gap-2 mb-6">
        {(["pending", "completed", "all"] as Tab[]).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "primary" : "ghost"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <Card hover={false}><p className="text-sm text-iron-grey">No submissions here.</p></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((s) => {
            const key = `${s.tile_id}:${s.team_id}`;
            const expanded = expandedKey === key;
            const state = submissionState(s);
            return (
              <Card key={key} hover={false}>
                <button onClick={() => setExpandedKey(expanded ? null : key)} className="w-full flex items-center justify-between gap-4 text-left cursor-pointer">
                  <div className="min-w-0">
                    <p className="font-semibold text-bark-brown truncate">
                      {s.tile_title} <span className="text-iron-grey">·</span> {s.team_name}
                    </p>
                    <p className="text-xs text-iron-grey">
                      {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "Not submitted"}
                      {state !== "pending" && <span className="ml-2 capitalize">· {state}{s.reviewed_by ? ` by ${s.reviewed_by}` : ""}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-gnome-green shrink-0">{expanded ? "Hide" : "View"}</span>
                </button>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-parchment-dark space-y-4">
                    {s.tile_description && <p className="text-sm text-bark-brown-light">{s.tile_description}</p>}

                    {(s.image_urls?.length ?? 0) > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {s.image_urls!.map((url, i) => <img key={i} src={url} alt="" className="w-full h-24 object-cover rounded-md border border-bark-brown-light" />)}
                      </div>
                    )}

                    {s.review_notes && (
                      <div>
                        <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">Review Notes</p>
                        <p className="text-sm text-bark-brown whitespace-pre-wrap">{s.review_notes}</p>
                      </div>
                    )}

                    {state === "pending" && (
                      <div>
                        <label className="block text-xs text-iron-grey mb-1">Notes (optional)</label>
                        <textarea
                          value={notesDraft[key] ?? ""}
                          onChange={(e) => setNotesDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                          rows={2}
                          maxLength={1000}
                          className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green mb-3"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busyKey === key} onClick={() => review(s, "completed")}>
                            {busyKey === key ? "..." : "Approve"}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-accent hover:bg-red-accent/10" disabled={busyKey === key} onClick={() => review(s, "incomplete")}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
