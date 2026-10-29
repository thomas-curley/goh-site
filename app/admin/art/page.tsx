"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/admin/bingo/BasicsStep";
import { ART_STATUS_CHIP } from "@/components/admin/art/ArtBuilder";
import { CONTEST_STATUS_LABELS, type ArtContest } from "@/lib/art";

type Listed = ArtContest & { entryCount: number; pendingCount: number; approvedCount: number; voterCount: number };

export default function ArtContestsAdminPage() {
  const router = useRouter();
  const [contests, setContests] = useState<Listed[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/art")
      .then((r) => r.json().then((d) => (r.ok ? d.contests ?? [] : [])))
      .catch(() => [])
      .then((list) => !cancelled && setContests(list));
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/art", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, copyFrom: copyFrom || null }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) router.push(`/admin/art/${json.id}`);
    else setError(json.error ?? "Couldn't create it.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-gnome-green">Art Contests</h1>
          <p className="text-bark-brown-light">Take entries, check them against the rules, let the clan vote, and show off the results in the gallery.</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>+ New art contest</Button>
      </div>

      {creating && (
        <Card hover={false} className="space-y-3">
          <h2 className="font-display text-xl text-bark-brown">New art contest</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="art-name" className="block text-sm font-semibold text-bark-brown mb-1">Name</label>
              <input id="art-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Spooky Gnomes Art Contest" autoFocus />
            </div>
            {(contests ?? []).length > 0 && (
              <div>
                <label htmlFor="art-copy" className="block text-sm font-semibold text-bark-brown mb-1">Start from</label>
                <select id="art-copy" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={`${inputClass} cursor-pointer`}>
                  <option value="">Nothing, start fresh</option>
                  {(contests ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      The settings of {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-xs text-iron-grey">It starts as a draft only staff can see.</p>
          {error && <p className="text-sm text-red-accent">{error}</p>}
          <div className="flex gap-2">
            <Button disabled={busy || !name.trim()} onClick={create}>
              {busy ? "Creating..." : "Create and set it up"}
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {contests === null ? (
        <p className="text-sm text-iron-grey">Loading...</p>
      ) : contests.length === 0 ? (
        <Card hover={false} className="text-center py-10 space-y-2">
          <p className="text-bark-brown">No art contests yet.</p>
          <p className="text-sm text-iron-grey">Press &quot;New art contest&quot; to set one up.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {contests.map((c) => (
            <Link key={c.id} href={`/admin/art/${c.id}`} className="block">
              <Card className="h-full space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-bark-brown break-words min-w-0">{c.name}</h2>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${ART_STATUS_CHIP[c.status]}`}>{CONTEST_STATUS_LABELS[c.status]}</span>
                </div>
                {c.theme && <p className="text-sm text-bark-brown-light">Theme: {c.theme}</p>}
                <p className="text-xs text-iron-grey">
                  {c.entryCount} entries · {c.approvedCount} approved · {c.voterCount} voters
                </p>
                {c.pendingCount > 0 && <p className="text-xs font-semibold text-gold">{c.pendingCount} waiting for review</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
