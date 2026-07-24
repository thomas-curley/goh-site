"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface FeatureRow {
  key: string;
  label: string;
  envVar: string | null;
  customChannelId: string | null;
  effectiveChannelId: string | null;
  source: "custom" | "env" | "unset";
}

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function AlertChannelsPage() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/alert-channels");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setFeatures(data.features ?? []);
      setDrafts(Object.fromEntries((data.features ?? []).map((f: FeatureRow) => [f.key, f.customChannelId ?? ""])));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (featureKey: string) => {
    setSavingKey(featureKey);
    setStatus(null);
    setErrors((prev) => ({ ...prev, [featureKey]: "" }));

    const res = await fetch("/api/admin/alert-channels", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureKey, input: drafts[featureKey] ?? "" }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setStatus(`Saved ${features.find((f) => f.key === featureKey)?.label ?? featureKey}.`);
      await load();
    } else {
      setErrors((prev) => ({ ...prev, [featureKey]: data.error ?? "Failed to save." }));
    }
    setSavingKey(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-2">Alert Channels</h1>
      <p className="text-sm text-bark-brown-light mb-6">
        Redirect where each feature posts to Discord — a channel/thread link or raw ID. Leave blank to use the
        environment default.
      </p>

      {status && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {status}
        </div>
      )}

      <div className="space-y-3">
        {features.map((f) => (
          <Card key={f.key} hover={false}>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-bark-brown mb-1">{f.label}</label>
                <input
                  type="text"
                  value={drafts[f.key] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder="https://discord.com/channels/.../.../... or a channel/thread ID"
                  className={inputClass}
                />
                <p className="text-xs text-iron-grey mt-1">
                  {f.source === "custom" && `Currently posting to ${f.effectiveChannelId} (custom).`}
                  {f.source === "env" && `Using the environment default (${f.envVar}): ${f.effectiveChannelId}.`}
                  {f.source === "unset" && (f.envVar ? `Not configured — ${f.envVar} isn't set either.` : "Not configured yet.")}
                </p>
                {errors[f.key] && <p className="text-xs text-red-accent mt-1">{errors[f.key]}</p>}
              </div>
              <Button size="sm" disabled={savingKey === f.key} onClick={() => save(f.key)}>
                {savingKey === f.key ? "Saving..." : "Save"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
