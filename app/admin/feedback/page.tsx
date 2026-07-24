"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface FeedbackSubmission {
  id: string;
  message: string;
  category: string | null;
  respondent_name: string | null;
  status: "new" | "reviewed" | "archived";
  created_at: string;
}

type Tab = "new" | "reviewed" | "archived" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "new", label: "New" },
  { key: "reviewed", label: "Reviewed" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

export default function AdminFeedbackPage() {
  const [tab, setTab] = useState<Tab>("new");
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const load = useCallback(async (activeTab: Tab) => {
    setLoading(true);
    const params = activeTab === "all" ? "" : `?status=${activeTab}`;
    const res = await fetch(`/api/feedback${params}`);
    const data = await res.json().catch(() => ({}));
    setSubmissions(res.ok ? data.submissions ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const updateStatus = async (submission: FeedbackSubmission, status: FeedbackSubmission["status"]) => {
    setBusyId(submission.id);
    const res = await fetch(`/api/feedback/${submission.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setActionStatus(`Marked as ${status}.`);
      await load(tab);
    } else {
      setActionStatus("Failed to update. Try again.");
    }
    setBusyId(null);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Feedback</h1>
      <p className="text-bark-brown-light mb-6">Submissions from the public feedback form.</p>

      {actionStatus && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {actionStatus}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "primary" : "ghost"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">Nothing here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <Card key={s.id} hover={false}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="text-sm font-semibold text-bark-brown">
                    {s.respondent_name || "Anonymous"}
                    {s.category && <span className="ml-2 text-xs text-iron-grey capitalize">· {s.category}</span>}
                  </p>
                  <p className="text-xs text-iron-grey">{new Date(s.created_at).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-sm text-bark-brown whitespace-pre-wrap mb-3">{s.message}</p>
              <div className="flex flex-wrap gap-2">
                {s.status !== "reviewed" && (
                  <Button size="sm" variant="ghost" disabled={busyId === s.id} onClick={() => updateStatus(s, "reviewed")}>
                    Mark Reviewed
                  </Button>
                )}
                {s.status !== "archived" && (
                  <Button size="sm" variant="ghost" disabled={busyId === s.id} onClick={() => updateStatus(s, "archived")}>
                    Archive
                  </Button>
                )}
                {s.status !== "new" && (
                  <Button size="sm" variant="ghost" disabled={busyId === s.id} onClick={() => updateStatus(s, "new")}>
                    Mark New
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
