"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface PointsRule {
  rule_key: string;
  label: string;
  points: number;
  enabled: boolean;
}

const inputClass = "w-24 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function AdminPointsPage() {
  const [rules, setRules] = useState<PointsRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { points: number; enabled: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/points");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setRules(data.rules ?? []);
      setDrafts(Object.fromEntries((data.rules ?? []).map((r: PointsRule) => [r.rule_key, { points: r.points, enabled: r.enabled }])));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (ruleKey: string) => {
    setSavingKey(ruleKey);
    setStatus(null);
    const draft = drafts[ruleKey];
    const res = await fetch("/api/admin/points", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleKey, points: draft.points, enabled: draft.enabled }),
    });
    if (res.ok) {
      setStatus(`Saved ${rules.find((r) => r.rule_key === ruleKey)?.label ?? ruleKey}.`);
      await load();
    } else {
      setStatus("Failed to save.");
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
      <h1 className="font-display text-3xl text-gnome-green mb-2">Clan Points Rules</h1>
      <p className="text-sm text-bark-brown-light mb-6">
        How many points each RuneLite plugin-reported event is worth. Disabling a rule stops both the points
        and the Discord notification for that event type.
      </p>

      {status && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {status}
        </div>
      )}

      <div className="space-y-3">
        {rules.map((r) => {
          const draft = drafts[r.rule_key] ?? { points: r.points, enabled: r.enabled };
          return (
            <Card key={r.rule_key} hover={false}>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 shrink-0">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [r.rule_key]: { ...draft, enabled: e.target.checked } }))}
                    className="w-4 h-4 accent-gnome-green cursor-pointer"
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-bark-brown">{r.label}</p>
                  <p className="text-xs text-iron-grey font-mono">{r.rule_key}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={draft.points}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [r.rule_key]: { ...draft, points: Number(e.target.value) } }))}
                  className={inputClass}
                />
                <Button size="sm" disabled={savingKey === r.rule_key} onClick={() => save(r.rule_key)}>
                  {savingKey === r.rule_key ? "Saving..." : "Save"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
