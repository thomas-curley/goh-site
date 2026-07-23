"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Answer {
  key: string;
  label: string;
  answer: string;
}

interface StaffApplication {
  id: string;
  discord_id: string;
  discord_username: string;
  rsn: string | null;
  answers: Answer[];
  status: "pending" | "accepted" | "rejected";
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

type Tab = "pending" | "accepted" | "rejected" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function AdminStaffApplicationsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (activeTab: Tab) => {
    setLoading(true);
    const params = activeTab === "all" ? "" : `?status=${activeTab}`;
    const res = await fetch(`/api/staff-applications${params}`);
    const data = await res.json().catch(() => ({}));
    setApplications(res.ok ? data.applications ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const selectTab = (t: Tab) => {
    setTab(t);
    setExpandedId(null);
  };

  const review = async (app: StaffApplication, status: "accepted" | "rejected") => {
    setBusyId(app.id);
    const res = await fetch(`/api/staff-applications/${app.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, review_notes: notesDraft[app.id] ?? "" }),
    });
    if (res.ok) {
      setActionStatus(`${status === "accepted" ? "Accepted" : "Rejected"} ${app.discord_username}'s application.`);
      await load(tab);
    } else {
      setActionStatus("Failed to update application. Try again.");
    }
    setBusyId(null);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Staff Applications</h1>
      <p className="text-bark-brown-light mb-6">
        Review applications submitted via <span className="font-mono text-xs">/apply</span>.
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
      ) : applications.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">No applications here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const expanded = expandedId === app.id;
            return (
              <Card key={app.id} hover={false}>
                <button
                  onClick={() => setExpandedId(expanded ? null : app.id)}
                  className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-bark-brown truncate">
                      {app.discord_username}
                      {app.rsn && <span className="text-iron-grey font-normal"> ({app.rsn})</span>}
                    </p>
                    <p className="text-xs text-iron-grey">
                      Submitted {new Date(app.created_at).toLocaleDateString()}
                      {app.status !== "pending" && (
                        <span className="ml-2 capitalize">
                          · {app.status}{app.reviewed_by ? ` by ${app.reviewed_by}` : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-gnome-green shrink-0">{expanded ? "Hide" : "View"}</span>
                </button>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-parchment-dark space-y-4">
                    {app.answers.map((a) => (
                      <div key={a.key}>
                        <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">{a.label}</p>
                        <p className="text-sm text-bark-brown whitespace-pre-wrap">{a.answer || "—"}</p>
                      </div>
                    ))}

                    {app.review_notes && (
                      <div>
                        <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">Review Notes</p>
                        <p className="text-sm text-bark-brown whitespace-pre-wrap">{app.review_notes}</p>
                      </div>
                    )}

                    {app.status === "pending" && (
                      <div>
                        <label className="block text-xs text-iron-grey mb-1">Notes (optional, shared with the decision)</label>
                        <textarea
                          value={notesDraft[app.id] ?? ""}
                          onChange={(e) => setNotesDraft((prev) => ({ ...prev, [app.id]: e.target.value }))}
                          rows={2}
                          maxLength={1000}
                          className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green mb-3"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busyId === app.id} onClick={() => review(app, "accepted")}>
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-accent hover:bg-red-accent/10"
                            disabled={busyId === app.id}
                            onClick={() => review(app, "rejected")}
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
