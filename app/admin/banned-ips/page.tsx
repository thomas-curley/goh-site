"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface BannedIp {
  id: string;
  ip_address: string;
  reason: string | null;
  banned_by: string | null;
  created_at: string;
}

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function AdminBannedIpsPage() {
  const [ipAddress, setIpAddress] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [bans, setBans] = useState<BannedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadBans = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/banned-ips");
    const data = await res.json().catch(() => ({}));
    setBans(res.ok ? data.bans ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadBans(); }, [loadBans]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setStatus(null);

    const res = await fetch("/api/admin/banned-ips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipAddress, reason }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setStatus(`Banned ${ipAddress}.`);
      setIpAddress("");
      setReason("");
      await loadBans();
    } else {
      setError(data.error ?? "Failed to ban that IP.");
    }
    setSubmitting(false);
  };

  const handleUnban = async (ban: BannedIp) => {
    if (!confirm(`Unban ${ban.ip_address}?`)) return;
    setRemovingId(ban.id);
    await fetch(`/api/admin/banned-ips/${ban.id}`, { method: "DELETE" });
    await loadBans();
    setRemovingId(null);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Banned IPs</h1>
      <p className="text-bark-brown-light mb-6">
        Block an IP address from submitting to public forms like surveys. Applies site-wide, not just one survey.
      </p>

      <Card hover={false} className="mb-8">
        <h3 className="font-display text-lg text-bark-brown mb-4">Ban an IP</h3>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>
        )}
        {status && (
          <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">IP Address *</label>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              required
              className={`${inputClass} font-mono`}
              placeholder="203.0.113.42"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Reason (optional)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Spamming the Q3 survey" />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Banning..." : "Ban IP"}
          </Button>
        </form>
      </Card>

      <h3 className="font-display text-lg text-bark-brown mb-4">Currently Banned</h3>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : bans.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">No IPs banned.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {bans.map((ban) => (
            <Card key={ban.id} hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-bark-brown">{ban.ip_address}</p>
                  {ban.reason && <p className="text-xs text-bark-brown-light">{ban.reason}</p>}
                  <p className="text-xs text-iron-grey">
                    {new Date(ban.created_at).toLocaleDateString()}
                    {ban.banned_by && <span> · by {ban.banned_by}</span>}
                  </p>
                </div>
                <Button size="sm" variant="ghost" disabled={removingId === ban.id} onClick={() => handleUnban(ban)}>
                  {removingId === ban.id ? "..." : "Unban"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
