"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ActivityMember, Focus } from "@/app/api/admin/activity/route";

type Preset = "week" | "month" | "all" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

const FOCUS_LABELS: Record<Focus, string> = {
  skiller: "Skiller",
  bosser: "Bosser",
  balanced: "Balanced",
  inactive: "Inactive",
};

const FOCUS_COLORS: Record<Focus, string> = {
  skiller: "#2D5016",
  bosser: "#8B1A1A",
  balanced: "#DAA520",
  inactive: "#6B6B6B",
};

interface Summary {
  totalMembers: number;
  activeCount: number;
  inactiveCount: number;
  newMembers: number;
  linkedCount: number;
  skillerCount: number;
  bosserCount: number;
  balancedCount: number;
  uniqueAttendees: number;
  attendanceRows: number;
}

type SortKey = "displayName" | "registeredAt" | "daysSinceActive" | "ehpGained" | "ehbGained" | "eventsAttended";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card hover={false} className="text-center py-3">
      <p className="font-stats text-xl text-gold-display font-bold">{value}</p>
      <p className="text-xs text-bark-brown-light">{label}</p>
    </Card>
  );
}

export default function AdminActivityPage() {
  const [preset, setPreset] = useState<Preset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [members, setMembers] = useState<ActivityMember[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ehpGained");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async (activePreset: Preset, start: string, end: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (activePreset === "custom") {
      if (start) params.set("start", new Date(start).toISOString());
      if (end) params.set("end", new Date(end + "T23:59:59").toISOString());
    } else {
      params.set("period", activePreset);
    }

    try {
      const res = await fetch(`/api/admin/activity?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members ?? []);
        setSummary(data.summary ?? null);
      } else {
        setError(data.error ?? "Failed to load activity data.");
      }
    } catch {
      setError("Failed to load activity data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(preset, customStart, customEnd); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectPreset = (p: Preset) => {
    setPreset(p);
    load(p, customStart, customEnd);
  };

  const applyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart && !customEnd) return;
    setPreset("custom");
    load("custom", customStart, customEnd);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedMembers = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      let av: string | number = a[sortKey] as string | number;
      let bv: string | number = b[sortKey] as string | number;
      if (sortKey === "daysSinceActive") {
        av = a.daysSinceActive ?? Infinity;
        bv = b.daysSinceActive ?? Infinity;
      }
      if (typeof av === "string" && typeof bv === "string") {
        av = av.toLowerCase();
        bv = bv.toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [members, sortKey, sortDir]);

  const topGainers = useMemo(() => {
    return [...members]
      .filter((m) => m.ehpGained > 0 || m.ehbGained > 0)
      .sort((a, b) => b.ehpGained + b.ehbGained - (a.ehpGained + a.ehbGained))
      .slice(0, 12)
      .map((m) => ({
        name: m.displayName,
        ehpGained: Math.round(m.ehpGained * 10) / 10,
        ehbGained: Math.round(m.ehbGained * 10) / 10,
      }));
  }, [members]);

  const focusData = summary
    ? [
        { key: "skiller" as Focus, count: summary.skillerCount },
        { key: "bosser" as Focus, count: summary.bosserCount },
        { key: "balanced" as Focus, count: summary.balancedCount },
        { key: "inactive" as Focus, count: summary.inactiveCount },
      ]
    : [];

  const inputClass = "px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";
  const thClass = "text-left py-2 px-2 cursor-pointer select-none hover:text-gnome-green";

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Player Activity</h1>
      <p className="text-bark-brown-light mb-6">
        Retention, engagement, and skilling-vs-bossing activity for the clan roster. For clan growth over
        time see the <Link href="/admin" className="text-gnome-green hover:underline">Dashboard</Link>; for
        full event attendance rankings see the <Link href="/leaderboard" className="text-gnome-green hover:underline">Leaderboard</Link>.
      </p>

      {/* Range filters */}
      <Card hover={false} className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {PRESETS.map((p) => (
            <Button key={p.key} size="sm" variant={preset === p.key ? "primary" : "ghost"} onClick={() => selectPreset(p.key)}>
              {p.label}
            </Button>
          ))}
        </div>
        <form onSubmit={applyCustomRange} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-iron-grey mb-1">From</label>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-iron-grey mb-1">To</label>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" size="sm" variant={preset === "custom" ? "primary" : "secondary"}>
            Apply Range
          </Button>
        </form>
      </Card>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <StatCard label="Clan Members" value={summary.totalMembers} />
              <StatCard label="Active" value={summary.activeCount} />
              <StatCard label="Gone Quiet" value={summary.inactiveCount} />
              <StatCard label="New Members" value={summary.newMembers} />
              <StatCard label="RSN-Linked" value={summary.linkedCount} />
              <StatCard label="Unique Attendees" value={summary.uniqueAttendees} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card hover={false}>
              <h3 className="font-display text-lg text-bark-brown mb-1">Skilling vs. Bossing</h3>
              <p className="text-xs text-iron-grey mb-4">Top gainers this range, by EHP/EHB gained</p>
              {topGainers.length === 0 ? (
                <p className="text-sm text-iron-grey">No gains recorded for this range yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topGainers}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8D5A8" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#555" }} angle={-30} textAnchor="end" height={60} interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "#555" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#F5E6C8", border: "1px solid #5C4033", borderRadius: "0.375rem", fontSize: "0.75rem" }} />
                    <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
                    <Bar dataKey="ehpGained" name="EHP Gained" fill="#2D5016" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ehbGained" name="EHB Gained" fill="#8B1A1A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card hover={false}>
              <h3 className="font-display text-lg text-bark-brown mb-1">Activity Breakdown</h3>
              <p className="text-xs text-iron-grey mb-4">Where the roster falls this range</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={focusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8D5A8" />
                  <XAxis dataKey="key" tickFormatter={(k) => FOCUS_LABELS[k as Focus] ?? k} tick={{ fontSize: 11, fill: "#555" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#555" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#F5E6C8", border: "1px solid #5C4033", borderRadius: "0.375rem", fontSize: "0.75rem" }}
                    labelFormatter={(k) => FOCUS_LABELS[k as Focus] ?? k}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {focusData.map((d) => (
                      <Cell key={d.key} fill={FOCUS_COLORS[d.key]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Full roster table */}
          <Card hover={false}>
            <h3 className="font-display text-lg text-bark-brown mb-4">
              Full Roster ({sortedMembers.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-bark-brown-light text-iron-grey text-xs uppercase tracking-wide">
                    <th className={thClass} onClick={() => toggleSort("displayName")}>RSN{sortArrow("displayName")}</th>
                    <th className="text-left py-2 px-2">Linked</th>
                    <th className="text-left py-2 px-2">Role</th>
                    <th className={thClass} onClick={() => toggleSort("registeredAt")}>Registered{sortArrow("registeredAt")}</th>
                    <th className={thClass} onClick={() => toggleSort("daysSinceActive")}>Last Active{sortArrow("daysSinceActive")}</th>
                    <th className={`${thClass} text-right`} onClick={() => toggleSort("ehpGained")}>EHP Gained{sortArrow("ehpGained")}</th>
                    <th className={`${thClass} text-right`} onClick={() => toggleSort("ehbGained")}>EHB Gained{sortArrow("ehbGained")}</th>
                    <th className="text-left py-2 px-2">Focus</th>
                    <th className={`${thClass} text-right`} onClick={() => toggleSort("eventsAttended")}>Events{sortArrow("eventsAttended")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m) => (
                    <tr key={m.username} className="border-b border-parchment-dark last:border-0">
                      <td className="py-2 px-2 font-mono text-bark-brown">{m.displayName}</td>
                      <td className="py-2 px-2">{m.linked ? "✓" : "—"}</td>
                      <td className="py-2 px-2 text-xs text-iron-grey capitalize">{m.clanRole?.replace(/_/g, " ")}</td>
                      <td className="py-2 px-2 text-xs text-iron-grey">
                        {new Date(m.registeredAt).toLocaleDateString()}
                        {m.isNew && <span className="ml-1 text-gnome-green">new</span>}
                      </td>
                      <td className="py-2 px-2 text-xs text-iron-grey">
                        {m.daysSinceActive === null ? "—" : `${m.daysSinceActive}d ago`}
                      </td>
                      <td className="py-2 px-2 text-right font-stats text-gnome-green">{m.ehpGained.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right font-stats text-red-accent">{m.ehbGained.toFixed(1)}</td>
                      <td className="py-2 px-2">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${FOCUS_COLORS[m.focus]}20`, color: FOCUS_COLORS[m.focus] }}
                        >
                          {FOCUS_LABELS[m.focus]}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-stats">{m.eventsAttended}</td>
                    </tr>
                  ))}
                  {sortedMembers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-4 text-center text-iron-grey">No members found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
