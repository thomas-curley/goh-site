"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { highlightTypeLabel } from "@/lib/gnomie-reviews";

interface GnomieReview {
  id: string;
  target_rsn: string;
  highlight_type: string;
  message: string;
  submitter_name: string | null;
  image_urls: string[];
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  discord_message_id: string | null;
  discord_channel_id: string | null;
  ip_address: string | null;
  created_at: string;
}

type Tab = "pending" | "approved" | "rejected" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function AdminGnomieReviewsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [reviews, setReviews] = useState<GnomieReview[]>([]);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (activeTab: Tab) => {
    setLoading(true);
    const params = activeTab === "all" ? "" : `?status=${activeTab}`;
    const res = await fetch(`/api/gnomie-reviews${params}`);
    const data = await res.json().catch(() => ({}));
    setReviews(res.ok ? data.reviews ?? [] : []);
    setGuildId(res.ok ? data.guildId ?? null : null);
    setLoading(false);
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const selectTab = (t: Tab) => {
    setTab(t);
    setExpandedId(null);
  };

  const review = async (r: GnomieReview, status: "approved" | "rejected") => {
    setBusyId(r.id);
    setActionStatus(null);
    const res = await fetch(`/api/gnomie-reviews/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, review_notes: notesDraft[r.id] ?? "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setActionStatus(`${status === "approved" ? "Approved and posted" : "Rejected"} the review for ${r.target_rsn}.`);
      await load(tab);
    } else {
      setActionStatus(data.error ?? "Failed to update review. Try again.");
    }
    setBusyId(null);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Review a Gn0mie</h1>
      <p className="text-bark-brown-light mb-6">
        Approve or reject shoutouts submitted via <span className="font-mono text-xs">/review-a-gnomie</span>.
        Approving posts it to the configured Discord highlight channel.
      </p>

      {actionStatus && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {actionStatus}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "primary" : "ghost"} onClick={() => selectTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">No reviews here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const expanded = expandedId === r.id;
            const type = highlightTypeLabel(r.highlight_type);
            const discordUrl = r.discord_message_id && r.discord_channel_id && guildId
              ? `https://discord.com/channels/${guildId}/${r.discord_channel_id}/${r.discord_message_id}`
              : null;
            return (
              <Card key={r.id} hover={false}>
                <button
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-bark-brown truncate">
                      {type.emoji} {type.label} for <span className="font-mono">{r.target_rsn}</span>
                    </p>
                    <p className="text-xs text-iron-grey">
                      From {r.submitter_name || "Anonymous"} · {new Date(r.created_at).toLocaleDateString()}
                      {r.status !== "pending" && (
                        <span className="ml-2 capitalize">
                          · {r.status}{r.reviewed_by ? ` by ${r.reviewed_by}` : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-gnome-green shrink-0">{expanded ? "Hide" : "View"}</span>
                </button>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-parchment-dark space-y-4">
                    <div>
                      <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">Message</p>
                      <p className="text-sm text-bark-brown whitespace-pre-wrap">{r.message}</p>
                    </div>

                    {r.image_urls.length > 0 && (
                      <div>
                        <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">Pictures</p>
                        <div className="grid grid-cols-3 gap-2">
                          {r.image_urls.map((url, i) => (
                            <img key={i} src={url} alt="" className="w-full h-24 object-cover rounded-md border border-bark-brown-light" />
                          ))}
                        </div>
                      </div>
                    )}

                    {r.ip_address && (
                      <p className="text-xs text-iron-grey">Submitted from IP: <span className="font-mono">{r.ip_address}</span></p>
                    )}

                    {r.review_notes && (
                      <div>
                        <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">Review Notes</p>
                        <p className="text-sm text-bark-brown whitespace-pre-wrap">{r.review_notes}</p>
                      </div>
                    )}

                    {discordUrl && (
                      <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gnome-green hover:underline inline-block">
                        View on Discord →
                      </a>
                    )}

                    {r.status === "pending" && (
                      <div>
                        <label className="block text-xs text-iron-grey mb-1">Notes (optional, shared with the decision)</label>
                        <textarea
                          value={notesDraft[r.id] ?? ""}
                          onChange={(e) => setNotesDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          rows={2}
                          maxLength={1000}
                          className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green mb-3"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busyId === r.id} onClick={() => review(r, "approved")}>
                            {busyId === r.id ? "..." : "Approve & Post"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-accent hover:bg-red-accent/10"
                            disabled={busyId === r.id}
                            onClick={() => review(r, "rejected")}
                          >
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
