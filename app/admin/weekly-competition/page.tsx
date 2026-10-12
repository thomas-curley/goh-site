"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RolePingSelector } from "@/components/admin/RolePingSelector";
import { DISCORD_MESSAGE_LIMIT, splitDiscordMessage } from "@/lib/weekly-announcement-templates";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

interface WeeklyConfig {
  current_competition_ids: number[];
  current_competition_type: "sotw" | "botw" | null;
  current_competition_name: string | null;
  current_week_start_date: string | null;
  next_competition_ids: number[];
  next_competition_type: "sotw" | "botw" | null;
  next_competition_name: string | null;
  current_forum_thread_id: string | null;
  ping_role_ids: string[] | null;
  raffle_prize_amount: number | string | null;
  last_run_at: string | null;
}

type Step = "results" | "forum" | "raffle";

interface Preview {
  results: { channelId: string; content: string } | null;
  forum: { channelId: string; title: string; content: string };
  raffle: { channelId: string; content: string } | null;
  nextEmoji: string;
  startDate: string;
  warnings: string[];
}

const STEP_LABEL: Record<Step, string> = {
  results: "Results (last week's thread)",
  forum: "New forum thread",
  raffle: "Raffle winners (announcements)",
};

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

  const [previousThread, setPreviousThread] = useState("");
  const [pingRoleIds, setPingRoleIds] = useState<string[]>([]);
  const [raffleText, setRaffleText] = useState("");
  const [raffleAmount, setRaffleAmount] = useState("1000000");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [include, setInclude] = useState<Record<Step, boolean>>({ results: true, forum: true, raffle: true });
  const [done, setDone] = useState<Step[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [generating, setGenerating] = useState(false);

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
      setPreviousThread(c.current_forum_thread_id ?? "");
      setPingRoleIds(c.ping_role_ids ?? []);
      if (c.raffle_prize_amount != null) setRaffleAmount(String(Number(c.raffle_prize_amount)));
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

  const generatePreview = async () => {
    setGenerating(true);
    setError(null);
    setStatus(null);
    const res = await fetch("/api/admin/weekly-competition/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        previousThread,
        pingRoleIds,
        raffleWinners: raffleText.split("\n").map((w) => w.trim()).filter(Boolean),
        raffleAmount: Number(raffleAmount.replace(/[^\d.]/g, "")) || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.preview) {
      setPreview(data.preview);
      setInclude({ results: !!data.preview.results, forum: true, raffle: !!data.preview.raffle });
      setDone([]);
    } else {
      setError(data.error ?? "Failed to build the preview.");
    }
    setGenerating(false);
  };

  const postAll = async () => {
    if (!preview) return;
    const pending = (["results", "forum", "raffle"] as const).filter((s) => include[s] && !done.includes(s) && (s !== "results" || preview.results) && (s !== "raffle" || preview.raffle));
    if (pending.length === 0) return;
    if (!confirm(`Post to Discord now?\n\n${pending.map((s) => `• ${STEP_LABEL[s]}`).join("\n")}`)) return;
    setRunning(true);
    setError(null);
    setStatus(null);
    const res = await fetch("/api/admin/weekly-competition/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        results: pending.includes("results") ? preview.results : undefined,
        forum: pending.includes("forum") ? { title: preview.forum.title, content: preview.forum.content, imageUrl: imageUrl.trim() } : undefined,
        raffle: pending.includes("raffle") ? preview.raffle : undefined,
        nextEmoji: preview.nextEmoji,
        startDate: preview.startDate,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const completed: Step[] = data.completed ?? [];
    // A forum thread that got created counts as done even if its follow-up
    // messages failed -- retrying would make a second thread.
    const nowDone = [...done, ...completed, ...(data.forumThreadId && !completed.includes("forum") ? (["forum"] as Step[]) : [])];
    setDone(nowDone);
    if (res.ok) {
      setStatus(`Posted: ${completed.map((s) => STEP_LABEL[s]).join(", ")}.${data.rotated ? " Rotated to next week." : ""}`);
    } else {
      setError(`${data.error ?? "Posting failed."}${completed.length ? ` (Already posted: ${completed.map((s) => STEP_LABEL[s]).join(", ")} -- those won't re-post on retry.)` : ""}`);
    }
    if (data.rotated) await load();
    setRunning(false);
  };

  const updatePreview = (step: Step, field: "content" | "title", value: string) => {
    setPreview((p) => {
      if (!p) return p;
      if (step === "forum") return { ...p, forum: { ...p.forum, [field]: value } };
      const current = p[step];
      return current ? { ...p, [step]: { ...current, content: value } } : p;
    });
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
        Sunday turnover: posts this week&apos;s results in its forum thread, opens next week&apos;s forum thread, and
        announces the raffle winners -- then rotates next week&apos;s competition into &quot;current.&quot;
      </p>

      {error && <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>}
      {status && <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>}

      <Card hover={false} className="mb-6">
        <h2 className="font-display text-lg text-bark-brown mb-3">Current Week</h2>
        <div className="text-sm text-bark-brown-light space-y-1">
          <p><span className="text-iron-grey">Name:</span> {config?.current_competition_name ?? "—"}</p>
          <p><span className="text-iron-grey">Type:</span> {config?.current_competition_type ?? "—"}</p>
          <p><span className="text-iron-grey">Competition id(s):</span> {(config?.current_competition_ids ?? []).join(", ") || "—"}</p>
          <p><span className="text-iron-grey">Week start:</span> {config?.current_week_start_date ?? "—"}</p>
          <p><span className="text-iron-grey">Forum thread:</span> {config?.current_forum_thread_id ?? "—"}</p>
          <p><span className="text-iron-grey">Last run:</span> {config?.last_run_at ? new Date(config.last_run_at).toLocaleString() : "Never"}</p>
        </div>
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

      <Card hover={false} className="mb-6">
        <h2 className="font-display text-lg text-bark-brown mb-1">Weekly Turnover</h2>
        <p className="text-xs text-iron-grey mb-4">
          Enter this week&apos;s raffle winners, generate the posts, tweak anything you like, then post. Prize amounts come
          from the default prize structure on the Payouts page.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">This week&apos;s forum thread (results get posted here)</label>
            <input type="text" value={previousThread} onChange={(e) => setPreviousThread(e.target.value)} className={inputClass} placeholder="Paste the thread link or id" />
            <p className="text-xs text-iron-grey mt-1">Filled in automatically after each turnover. Leave blank to skip the results post.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Results ping</label>
            <RolePingSelector selectedRoles={pingRoleIds} onChange={setPingRoleIds} />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-bark-brown mb-1">Raffle winners (one per line)</label>
              <textarea value={raffleText} onChange={(e) => setRaffleText(e.target.value)} rows={4} className={inputClass} placeholder={"Gn0me Rika\nKryssyWolf\nGn0me Pack"} />
            </div>
            <div className="sm:w-48">
              <label className="block text-sm font-semibold text-bark-brown mb-1">GP per raffle winner</label>
              <input type="text" inputMode="numeric" value={raffleAmount} onChange={(e) => setRaffleAmount(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <Button size="sm" className="mt-4" disabled={generating || running} onClick={generatePreview}>
          {generating ? "Generating (can take ~30s)..." : preview ? "Regenerate Preview" : "Generate Preview"}
        </Button>

        {preview && (
          <div className="mt-6 pt-4 border-t border-parchment-dark space-y-6">
            {preview.warnings.length > 0 && (
              <ul className="p-3 rounded-md bg-amber-100/60 border border-amber-300 text-xs text-bark-brown list-disc pl-6 space-y-1">
                {preview.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}

            {(["results", "forum", "raffle"] as const).map((step) => {
              const post = preview[step];
              if (!post) return null;
              const messageCount = splitDiscordMessage(post.content).length;
              const isDone = done.includes(step);
              return (
                <div key={step}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="flex items-center gap-2 text-sm font-semibold text-bark-brown cursor-pointer">
                      <input type="checkbox" checked={include[step]} disabled={isDone} onChange={(e) => setInclude((i) => ({ ...i, [step]: e.target.checked }))} className="accent-gnome-green" />
                      {STEP_LABEL[step]}
                    </label>
                    <span className={`text-xs ${isDone ? "text-gnome-green font-semibold" : "text-iron-grey"}`}>
                      {isDone ? "Posted ✓" : `${post.content.length.toLocaleString()} chars${messageCount > 1 ? ` · ${messageCount} messages (${DISCORD_MESSAGE_LIMIT} max each)` : ""}`}
                    </span>
                  </div>
                  {step === "forum" && (
                    <input type="text" value={preview.forum.title} disabled={isDone} onChange={(e) => updatePreview("forum", "title", e.target.value)} className={`${inputClass} mb-2 font-semibold`} />
                  )}
                  <textarea
                    value={post.content}
                    disabled={isDone}
                    onChange={(e) => updatePreview(step, "content", e.target.value)}
                    rows={step === "forum" ? 24 : 12}
                    className={`${inputClass} font-mono text-xs`}
                  />
                  {step === "forum" && (
                    <input type="text" value={imageUrl} disabled={isDone} onChange={(e) => setImageUrl(e.target.value)} className={`${inputClass} mt-2`} placeholder="Optional image URL shown at the bottom (https://...)" />
                  )}
                </div>
              );
            })}

            <Button size="sm" disabled={running || generating} onClick={postAll}>
              {running ? "Posting..." : done.length ? "Post Remaining" : "Post Everything"}
            </Button>
          </div>
        )}
      </Card>

      <Card hover={false}>
        <button type="button" onClick={() => setShowRecovery((v) => !v)} className="text-sm text-gnome-green hover:underline cursor-pointer">
          {showRecovery ? "Hide manual recovery" : "Manual recovery (edit Current Week directly)"}
        </button>
        {showRecovery && (
          <div className="mt-4 pt-4 border-t border-parchment-dark space-y-4">
            <p className="text-xs text-iron-grey">
              Only needed if a run failed partway or the config needs fixing by hand -- normally Current Week is only
              ever written by the turnover&apos;s own rotation.
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
