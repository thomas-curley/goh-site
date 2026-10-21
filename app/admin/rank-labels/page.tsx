"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { inputClass } from "@/components/admin/bingo/BasicsStep";
import { RANKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Draft = Record<string, { label: string; description: string }>;

const empty = (): Draft => Object.fromEntries(RANKS.map((r) => [r.key, { label: "", description: "" }]));

export default function RankLabelsPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/rank-labels")
      .then((r) => r.json())
      .then((d: { labels?: Record<string, { label: string | null; description: string | null }> }) => {
        if (cancelled) return;
        const next = empty();
        for (const [key, v] of Object.entries(d.labels ?? {})) if (next[key]) next[key] = { label: v.label ?? "", description: v.description ?? "" };
        setDraft(next);
      })
      .catch(() => !cancelled && setDraft(empty()));
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (key: string, field: "label" | "description", value: string) => {
    setDraft((d) => (d ? { ...d, [key]: { ...d[key], [field]: value } } : d));
    setStatus(null);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const res = await fetch("/api/admin/rank-labels", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labels: draft }) });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    setStatus(res.ok ? { ok: true, text: "Saved. Reload any page to see the new names." } : { ok: false, text: json.error ?? "Couldn't save." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-gnome-green">Rank Labels</h1>
        <p className="text-bark-brown-light max-w-3xl">
          Choose what each rank is called across the site: badges, the Rank Structure page, Gn0meBook, and the admin pages. Leave a box empty to use the standard name. Ranks still come from each member&apos;s Wise Old Man role; this only changes how they&apos;re shown.
        </p>
      </div>

      {draft === null ? (
        <p className="text-sm text-iron-grey">Loading...</p>
      ) : (
        <Card hover={false} className="p-0 overflow-hidden">
          <ul className="divide-y divide-bark-brown-light/20">
            {[...RANKS].reverse().map((rank) => {
              const d = draft[rank.key];
              const shown = d.label.trim() || rank.name;
              return (
                <li key={rank.key} className="p-4 grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
                  <div className="space-y-1">
                    <Badge className={cn(rank.color)}>{shown}</Badge>
                    <p className="text-xs text-iron-grey">
                      {rank.name}
                      {rank.wom !== rank.name && ` · ${rank.wom} on Wise Old Man`}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                    <label className="text-xs text-bark-brown">
                      Shown as
                      <input value={d.label} maxLength={40} onChange={(e) => set(rank.key, "label", e.target.value)} placeholder={rank.name} className={`${inputClass} mt-1`} />
                    </label>
                    <label className="text-xs text-bark-brown">
                      Description on the Rank Structure page
                      <input value={d.description} maxLength={300} onChange={(e) => set(rank.key, "description", e.target.value)} placeholder={rank.description} className={`${inputClass} mt-1`} />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={saving || !draft} onClick={save}>
          {saving ? "Saving..." : "Save labels"}
        </Button>
        {status && <span className={`text-sm ${status.ok ? "text-gnome-green" : "text-red-accent"}`}>{status.text}</span>}
      </div>
    </div>
  );
}
