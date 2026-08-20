"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BingoEventForm, type BingoEventFormInitial } from "@/components/admin/bingo/BingoEventForm";

export default function EditBingoEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [initial, setInitial] = useState<BingoEventFormInitial | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/bingo/${eventId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setInitial(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [eventId]);

  const setEventStatus = async (newStatus: "draft" | "active" | "completed") => {
    setStatusSaving(true);
    setStatus(null);
    const res = await fetch(`/api/admin/bingo/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setStatus(`Status set to ${newStatus}.`);
      setInitial((prev) => (prev ? { ...prev, event: { ...prev.event, status: newStatus } } : prev));
    } else {
      setStatus("Failed to update status.");
    }
    setStatusSaving(false);
  };

  const refreshWom = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    const res = await fetch(`/api/admin/bingo/${eventId}/refresh`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setRefreshResult(res.ok ? `Synced ${data.tilesSynced} WOM tile(s).${data.errors?.length ? ` ${data.errors.length} error(s).` : ""}` : "Refresh failed.");
    setRefreshing(false);
  };

  const deleteEvent = async () => {
    if (!confirm("Delete this bingo event? This can't be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/bingo/${eventId}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/bingo/list");
    else setDeleting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !initial) {
    return (
      <div>
        <p className="text-bark-brown-light">Bingo event not found.</p>
        <Link href="/admin/bingo/list" className="text-sm text-gnome-green hover:underline">← Back to Bingo Events</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="font-display text-3xl text-gnome-green">{initial.event.name}</h1>
        <Link href={`/admin/bingo/${eventId}/review`} className="text-sm text-gnome-green hover:underline shrink-0">Review Submissions →</Link>
      </div>
      <p className="text-bark-brown-light mb-4">Editing this bingo event.</p>

      <Card hover={false} className="mb-6">
        {status && <p className="text-sm text-gnome-green mb-3">{status}</p>}
        {refreshResult && <p className="text-sm text-bark-brown mb-3">{refreshResult}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-bark-brown uppercase tracking-wide">Status:</span>
          {(["draft", "active", "completed"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={initial.event.status === s ? "primary" : "ghost"}
              disabled={statusSaving}
              onClick={() => setEventStatus(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
          <div className="flex-1" />
          <Button size="sm" variant="secondary" disabled={refreshing} onClick={refreshWom}>
            {refreshing ? "Refreshing..." : "Refresh WOM Progress Now"}
          </Button>
          <Button size="sm" variant="ghost" className="text-red-accent hover:bg-red-accent/10" disabled={deleting} onClick={deleteEvent}>
            {deleting ? "Deleting..." : "Delete Event"}
          </Button>
        </div>
      </Card>

      <BingoEventForm initial={initial} />
    </div>
  );
}
