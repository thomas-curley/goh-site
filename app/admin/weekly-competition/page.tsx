"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

interface WeeklyConfig {
  current_competition_ids: number[];
  current_competition_type: "sotw" | "botw" | null;
  current_competition_name: string | null;
  current_week_start_date: string | null;
  next_competition_ids: number[];
  next_competition_type: "sotw" | "botw" | null;
  next_competition_name: string | null;
  last_run_at: string | null;
}

function idsToInputs(ids: number[]): [string, string] {
  return [ids[0] != null ? String(ids[0]) : "", ids[1] != null ? String(ids[1]) : ""];
}

function parseIds(a: string, b: string): number[] {
  return [a, b].map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => Number.isInteger(n));
}

export default function WeeklyCompetitionPage() {
  const [config, setConfig] = useState<WeeklyConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [nextType, setNextType] = useState<"sotw" | "botw">("sotw");
  const [nextName, setNextName] = useState("");
  const [nextId1, setNextId1] = useState("");
  const [nextId2, setNextId2] = useState("");

  const [showRecovery, setShowRecovery] = useState(false);
  const [currentType, setCurrentType] = useState<"sotw" | "botw">("sotw");
  const [currentName, setCurrentName] = useState("");
  const [currentId1, setCurrentId1] = useState("");
  const [currentId2, setCurrentId2] = useState("");
  const [currentWeekStart, setCurrentWeekStart] = useState("");

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/weekly-competition");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.config) {
      const c: WeeklyConfig = data.config;
      setConfig(c);
      setNextType(c.next_competition_type ?? "sotw");
      setNextName(c.next_competition_name ?? "");
      const [n1, n2] = idsToInputs(c.next_competition_ids ?? []);
      setNextId1(n1);
      setNextId2(n2);
      setCurrentType(c.current_competition_type ?? "sotw");
      setCurrentName(c.current_competition_name ?? "");
      const [c1, c2] = idsToInputs(c.current_competition_ids ?? []);
      setCurrentId1(c1);
      setCurrentId2(c2);
      setCurrentWeekStart(c.current_week_start_date ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveNext = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    const res = await fetch("/api/admin/weekly-competition", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nextCompetitionType: nextType,
        nextCompetitionName: nextName.trim(),
        nextCompetitionIds: parseIds(nextId1, nextId2),
      }),
    });
    if (res.ok) {
      setStatus("Next week's competition saved.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save.");
    }
    setSaving(false);
  };

  const saveCurrent = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    const res = await fetch("/api/admin/weekly-competition", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentCompetitionType: currentType,
        currentCompetitionName: currentName.trim(),
        currentCompetitionIds: parseIds(currentId1, currentId2),
        currentWeekStartDate: currentWeekStart || null,
      }),
    });
    if (res.ok) {
      setStatus("Current week updated.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save.");
    }
    setSaving(false);
  };

  const runNow = async () => {
    if (!confirm("Run the weekly announcement now? This posts results + the new-week announcement + the forum thread immediately.")) return;
    setRunning(true);
    setError(null);
    setStatus(null);
    const res = await fetch("/api/cron/weekly-announcement", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus(data.skipped ? `Skipped: ${data.reason}` : `Posted! Rotated to "${data.rotatedTo}".`);
      await load();
    } else {
      setError(data.error ?? "Run failed.");
    }
    setRunning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Weekly SOTW/BotW</h1>
      <p className="text-bark-brown-light mb-6">
        Configures the automated Sunday 8PM announcement cron -- posts results, the new-week announcement, and the
        forum thread, then rotates this week's competition into &quot;current.&quot;
      </p>

      {error && <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>}
      {status && <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>}

      <Card hover={false} className="mb-6">
        <h2 className="font-display text-lg text-bark-brown mb-3">Current Week</h2>
        <div className="text-sm text-bark-brown-light space-y-1 mb-4">
          <p><span className="text-iron-grey">Name:</span> {config?.current_competition_name ?? "—"}</p>
          <p><span className="text-iron-grey">Type:</span> {config?.current_competition_type ?? "—"}</p>
          <p><span className="text-iron-grey">Competition id(s):</span> {(config?.current_competition_ids ?? []).join(", ") || "—"}</p>
          <p><span className="text-iron-grey">Week start:</span> {config?.current_week_start_date ?? "—"}</p>
          <p><span className="text-iron-grey">Last run:</span> {config?.last_run_at ? new Date(config.last_run_at).toLocaleString() : "Never"}</p>
        </div>
        <Button size="sm" disabled={running} onClick={runNow}>
          {running ? "Running..." : "Run Now"}
        </Button>
        <p className="text-xs text-iron-grey mt-2">
          Posts immediately using the current/next config below. Normally this only needs to run via the Sunday cron.
        </p>
      </Card>

      <Card hover={false} className="mb-6">
        <h2 className="font-display text-lg text-bark-brown mb-1">Next Week</h2>
        <p className="text-xs text-iron-grey mb-4">
          Fill this in after the poll decides next week&apos;s skill/boss. Create the competition itself under Admin
          {" > "}WOM Competitions first, then link its id(s) here.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-2">Type</label>
            <div className="flex gap-4">
              {(["sotw", "botw"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
                  <input type="radio" checked={nextType === t} onChange={() => setNextType(t)} className="accent-gnome-green" />
                  {t === "sotw" ? "Skill of the Week" : "Boss of the Week"}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Competition Name</label>
            <input type="text" value={nextName} onChange={(e) => setNextName(e.target.value)} className={inputClass} placeholder="e.g. Fishing, or The Gauntlet" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-bark-brown mb-1">WOM Competition ID</label>
              <input type="number" value={nextId1} onChange={(e) => setNextId1(e.target.value)} className={inputClass} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-bark-brown mb-1">Second ID (optional, dual BotW)</label>
              <input type="number" value={nextId2} onChange={(e) => setNextId2(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <Button size="sm" className="mt-4" disabled={saving || !nextName.trim() || !nextId1.trim()} onClick={saveNext}>
          {saving ? "Saving..." : "Save Next Week"}
        </Button>
      </Card>

      <Card hover={false}>
        <button type="button" onClick={() => setShowRecovery((v) => !v)} className="text-sm text-gnome-green hover:underline cursor-pointer">
          {showRecovery ? "Hide manual recovery" : "Manual recovery (edit Current Week directly)"}
        </button>
        {showRecovery && (
          <div className="mt-4 pt-4 border-t border-parchment-dark space-y-4">
            <p className="text-xs text-iron-grey">
              Only needed if a run failed partway or the config needs fixing by hand -- normally Current Week is only
              ever written by the cron&apos;s own rotation.
            </p>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-2">Type</label>
              <div className="flex gap-4">
                {(["sotw", "botw"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
                    <input type="radio" checked={currentType === t} onChange={() => setCurrentType(t)} className="accent-gnome-green" />
                    {t === "sotw" ? "Skill of the Week" : "Boss of the Week"}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Competition Name</label>
              <input type="text" value={currentName} onChange={(e) => setCurrentName(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-bark-brown mb-1">WOM Competition ID</label>
                <input type="number" value={currentId1} onChange={(e) => setCurrentId1(e.target.value)} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-bark-brown mb-1">Second ID (optional)</label>
                <input type="number" value={currentId2} onChange={(e) => setCurrentId2(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Week Start Date</label>
              <input type="date" value={currentWeekStart} onChange={(e) => setCurrentWeekStart(e.target.value)} className={`${inputClass} sm:w-48`} />
            </div>
            <Button size="sm" variant="secondary" disabled={saving} onClick={saveCurrent}>
              {saving ? "Saving..." : "Save Current Week"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
