"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface Snapshot {
  date: string;
  member_count: number;
  total_exp: number;
  registered_users: number;
  linked_rsns: number;
  events_count: number;
  total_ehp: number;
  total_ehb: number;
}

interface RecentMember {
  displayName: string;
  type: string;
  registeredAt: string;
}

interface RecentUser {
  discord_username: string;
  discord_nickname: string | null;
  rsn: string | null;
  created_at: string;
}

function formatNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function AdminDashboard() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentMembers, setRecentMembers] = useState<RecentMember[]>([]);
  const [currentStats, setCurrentStats] = useState<{
    members: number; exp: number; users: number; linked: number;
    events: number; ehp: number; ehb: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  const supabase = createSupabaseBrowserClient();

  const loadData = useCallback(async () => {
    // Load snapshots
    const { data: snaps } = await supabase
      .from("clan_snapshots")
      .select("*")
      .order("date", { ascending: true })
      .limit(90);
    if (snaps) setSnapshots(snaps);

    // Load recent site registrations
    const { data: users } = await supabase
      .from("user_profiles")
      .select("discord_username, discord_nickname, rsn, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (users) setRecentUsers(users);

    // Fetch live WOM data
    try {
      const womRes = await fetch("https://api.wiseoldman.net/v2/groups/24582");
      if (womRes.ok) {
        const wom = await womRes.json();
        const memberships = wom.memberships ?? [];
        const totalExp = memberships.reduce((s: number, m: { player: { exp: number } }) => s + (m.player.exp ?? 0), 0);
        const totalEhp = memberships.reduce((s: number, m: { player: { ehp: number } }) => s + (m.player.ehp ?? 0), 0);
        const totalEhb = memberships.reduce((s: number, m: { player: { ehb: number } }) => s + (m.player.ehb ?? 0), 0);

        // Recent WOM members (by registration date)
        const sorted = [...memberships]
          .sort((a: { player: { registeredAt: string } }, b: { player: { registeredAt: string } }) =>
            new Date(b.player.registeredAt).getTime() - new Date(a.player.registeredAt).getTime()
          )
          .slice(0, 5);
        setRecentMembers(sorted.map((m: { player: { displayName: string; type: string; registeredAt: string } }) => ({
          displayName: m.player.displayName,
          type: m.player.type,
          registeredAt: m.player.registeredAt,
        })));

        const { count: userCount } = await supabase
          .from("user_profiles")
          .select("*", { count: "exact", head: true });
        const { count: linkedCount } = await supabase
          .from("user_profiles")
          .select("*", { count: "exact", head: true })
          .not("rsn", "is", null);
        const { count: eventsCount } = await supabase
          .from("events")
          .select("*", { count: "exact", head: true });

        setCurrentStats({
          members: memberships.length,
          exp: totalExp,
          users: userCount ?? 0,
          linked: linkedCount ?? 0,
          events: eventsCount ?? 0,
          ehp: Math.round(totalEhp),
          ehb: Math.round(totalEhb),
        });
      }
    } catch { /* WOM unavailable */ }

    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const captureSnapshot = async () => {
    setCapturing(true);
    await fetch("/api/snapshots/capture", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SITE_URL ? "" : ""}` },
    });
    await loadData();
    setCapturing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate changes from snapshots
  const latest = snapshots[snapshots.length - 1];
  const weekAgo = snapshots[Math.max(0, snapshots.length - 7)];
  const memberDelta = latest && weekAgo ? latest.member_count - weekAgo.member_count : 0;
  const expDelta = latest && weekAgo ? latest.total_exp - weekAgo.total_exp : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-gnome-green">Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={captureSnapshot} disabled={capturing}>
          {capturing ? "Capturing..." : "📸 Capture Snapshot"}
        </Button>
      </div>

      {/* Live Stats */}
      {currentStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <StatCard label="Clan Members" value={currentStats.members} delta={memberDelta} />
          <StatCard label="Total XP" value={formatNum(currentStats.exp)} delta={expDelta ? `+${formatNum(expDelta)}` : undefined} />
          <StatCard label="Total EHP" value={formatNum(currentStats.ehp)} />
          <StatCard label="Total EHB" value={formatNum(currentStats.ehb)} />
          <StatCard label="Site Users" value={currentStats.users} />
          <StatCard label="Linked RSNs" value={currentStats.linked} />
          <StatCard label="Events" value={currentStats.events} />
        </div>
      )}

      {/* Charts */}
      {snapshots.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card hover={false}>
            <h3 className="font-display text-lg text-bark-brown mb-4">Member Count</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D5A8" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }} tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 10, fill: "#555" }} domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip contentStyle={{ backgroundColor: "#F5E6C8", border: "1px solid #5C4033", borderRadius: "0.375rem", fontSize: "0.75rem" }} />
                <Area type="monotone" dataKey="member_count" stroke="#2D5016" fill="#2D501640" strokeWidth={2} name="Members" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card hover={false}>
            <h3 className="font-display text-lg text-bark-brown mb-4">Total Clan XP</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D5A8" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }} tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 10, fill: "#555" }} tickFormatter={(v: number) => formatNum(v)} />
                <Tooltip contentStyle={{ backgroundColor: "#F5E6C8", border: "1px solid #5C4033", borderRadius: "0.375rem", fontSize: "0.75rem" }} formatter={(v) => [formatNum(Number(v)), "Total XP"]} />
                <Area type="monotone" dataKey="total_exp" stroke="#DAA520" fill="#DAA52040" strokeWidth={2} name="Total XP" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card hover={false}>
            <h3 className="font-display text-lg text-bark-brown mb-4">Site Registrations</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D5A8" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }} tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 10, fill: "#555" }} />
                <Tooltip contentStyle={{ backgroundColor: "#F5E6C8", border: "1px solid #5C4033", borderRadius: "0.375rem", fontSize: "0.75rem" }} />
                <Line type="monotone" dataKey="registered_users" stroke="#4A7C23" strokeWidth={2} dot={false} name="Registered" />
                <Line type="monotone" dataKey="linked_rsns" stroke="#DAA520" strokeWidth={2} dot={false} name="Linked RSNs" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card hover={false}>
            <h3 className="font-display text-lg text-bark-brown mb-4">Clan EHP & EHB</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D5A8" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }} tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 10, fill: "#555" }} tickFormatter={(v: number) => formatNum(v)} />
                <Tooltip contentStyle={{ backgroundColor: "#F5E6C8", border: "1px solid #5C4033", borderRadius: "0.375rem", fontSize: "0.75rem" }} formatter={(v) => [formatNum(Number(v))]} />
                <Line type="monotone" dataKey="total_ehp" stroke="#2D5016" strokeWidth={2} dot={false} name="EHP" />
                <Line type="monotone" dataKey="total_ehb" stroke="#8B1A1A" strokeWidth={2} dot={false} name="EHB" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {snapshots.length <= 1 && (
        <Card hover={false} className="mb-8 text-center py-8">
          <p className="text-bark-brown-light">
            No historical data yet. Click &quot;Capture Snapshot&quot; to start tracking trends.
            Set up a daily cron to <code className="font-mono text-gnome-green text-xs">POST /api/snapshots/capture</code> for automatic tracking.
          </p>
        </Card>
      )}

      {/* Activity Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card hover={false}>
          <h3 className="font-display text-lg text-bark-brown mb-4">Newest WOM Members</h3>
          {recentMembers.length === 0 ? (
            <p className="text-sm text-iron-grey">No data.</p>
          ) : (
            <div className="space-y-2">
              {recentMembers.map((m) => (
                <div key={m.displayName} className="flex items-center justify-between py-1">
                  <div>
                    <span className="font-mono text-sm text-gnome-green">{m.displayName}</span>
                    {m.type !== "regular" && (
                      <span className="text-xs text-iron-grey ml-2">{m.type.replace(/_/g, " ")}</span>
                    )}
                  </div>
                  <span className="text-xs text-iron-grey">
                    {new Date(m.registeredAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card hover={false}>
          <h3 className="font-display text-lg text-bark-brown mb-4">Recent Site Registrations</h3>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-iron-grey">No users registered yet.</p>
          ) : (
            <div className="space-y-2">
              {recentUsers.map((u, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-sm text-bark-brown font-semibold">
                      {u.discord_nickname ?? u.discord_username}
                    </span>
                    {u.rsn && (
                      <span className="font-mono text-xs text-gnome-green ml-2">{u.rsn}</span>
                    )}
                  </div>
                  <span className="text-xs text-iron-grey">
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, delta }: { label: string; value: string | number; delta?: number | string }) {
  return (
    <Card hover={false} className="text-center py-3">
      <p className="font-stats text-xl text-gold-display font-bold">{value}</p>
      <p className="text-xs text-bark-brown-light">{label}</p>
      {delta !== undefined && delta !== 0 && (
        <p className={`text-xs mt-1 font-semibold ${
          typeof delta === "number" ? (delta > 0 ? "text-gnome-green" : "text-red-accent") : "text-gnome-green"
        }`}>
          {typeof delta === "number" ? (delta > 0 ? `+${delta}` : delta) : delta}
        </p>
      )}
    </Card>
  );
}
