"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";

interface Testimonial {
  id: string;
  rsn: string;
  rating: number;
  message: string;
  status: "pending" | "approved" | "rejected";
  featured: boolean;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

type Tab = "pending" | "approved" | "rejected" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function AdminTestimonialsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (activeTab: Tab) => {
    setLoading(true);
    const params = activeTab === "all" ? "" : `?status=${activeTab}`;
    const res = await fetch(`/api/admin/testimonials${params}`);
    const data = await res.json().catch(() => ({}));
    setTestimonials(res.ok ? data.testimonials ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const selectTab = (t: Tab) => {
    setTab(t);
    setExpandedId(null);
  };

  const review = async (t: Testimonial, status: "approved" | "rejected") => {
    setBusyId(t.id);
    setActionStatus(null);
    const res = await fetch(`/api/admin/testimonials/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNotes: notesDraft[t.id] ?? "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setActionStatus(`${status === "approved" ? "Approved" : "Rejected"} ${t.rsn}'s testimonial.`);
      await load(tab);
    } else {
      setActionStatus(data.error ?? "Failed to update. Try again.");
    }
    setBusyId(null);
  };

  const toggleFeatured = async (t: Testimonial) => {
    setBusyId(t.id);
    setActionStatus(null);
    const res = await fetch(`/api/admin/testimonials/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !t.featured }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await load(tab);
    } else {
      setActionStatus(data.error ?? "Failed to update.");
    }
    setBusyId(null);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Testimonials</h1>
      <p className="text-bark-brown-light mb-6">
        Approve or reject public clan testimonials. Approved ones can be marked Featured to show on the Homepage and
        About page -- the full approved list always shows on <span className="font-mono text-xs">/testimonials</span>.
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
      ) : testimonials.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">No testimonials here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {testimonials.map((t) => {
            const expanded = expandedId === t.id;
            return (
              <Card key={t.id} hover={false}>
                <button
                  onClick={() => setExpandedId(expanded ? null : t.id)}
                  className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-bark-brown truncate flex items-center gap-2">
                      <span className="font-mono">{t.rsn}</span>
                      <StarRating value={t.rating} readOnly size="sm" />
                      {t.featured && <span className="text-xs px-1.5 py-0.5 rounded bg-gold/15 text-gold">Featured</span>}
                    </p>
                    <p className="text-xs text-iron-grey">
                      {new Date(t.created_at).toLocaleDateString()}
                      {t.status !== "pending" && (
                        <span className="ml-2 capitalize">
                          · {t.status}{t.reviewed_by ? ` by ${t.reviewed_by}` : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-gnome-green shrink-0">{expanded ? "Hide" : "View"}</span>
                </button>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-parchment-dark space-y-4">
                    <p className="text-sm text-bark-brown whitespace-pre-wrap">{t.message}</p>

                    {t.review_notes && (
                      <div>
                        <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">Review Notes</p>
                        <p className="text-sm text-bark-brown whitespace-pre-wrap">{t.review_notes}</p>
                      </div>
                    )}

                    {t.status === "approved" && (
                      <Button size="sm" variant={t.featured ? "primary" : "ghost"} disabled={busyId === t.id} onClick={() => toggleFeatured(t)}>
                        {busyId === t.id ? "..." : t.featured ? "★ Featured (click to unfeature)" : "☆ Feature this testimonial"}
                      </Button>
                    )}

                    {t.status === "pending" && (
                      <div>
                        <label className="block text-xs text-iron-grey mb-1">Notes (optional, shared with the decision)</label>
                        <textarea
                          value={notesDraft[t.id] ?? ""}
                          onChange={(e) => setNotesDraft((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          rows={2}
                          maxLength={1000}
                          className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green mb-3"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busyId === t.id} onClick={() => review(t, "approved")}>
                            {busyId === t.id ? "..." : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-accent hover:bg-red-accent/10"
                            disabled={busyId === t.id}
                            onClick={() => review(t, "rejected")}
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
