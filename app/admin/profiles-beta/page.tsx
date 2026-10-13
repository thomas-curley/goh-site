"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CharacterEditor } from "@/components/profiles/CharacterEditor";

export default function AdminProfilesBetaPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setResult(null);
    const res = await fetch("/api/admin/clan-rankings", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setRefreshing(false);
    if (!res.ok) setResult(data.error ?? "Refresh failed.");
    else setResult(`Refreshed ${data.refreshed} stats${data.failed?.length ? `; ${data.failed.length} couldn't be loaded from Wise Old Man (${data.failed.slice(0, 5).join(", ")}${data.failed.length > 5 ? "..." : ""})` : ""}.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-gnome-green mb-1">Member Profiles (Beta)</h1>
        <p className="text-bark-brown-light">
          Staff-only &quot;logs&quot;-style member profiles at{" "}
          <Link href="/members/beta" className="text-gnome-green hover:underline">/members/beta</Link>. Set the clan&apos;s default character and
          refresh the clan rankings here.
        </p>
      </div>

      <Card hover={false}>
        <h2 className="font-display text-xl text-bark-brown mb-1">Clan default character</h2>
        <p className="text-sm text-bark-brown-light mb-4">The gnome fashionscape: the look and gear shown for members who haven&apos;t picked their own.</p>
        <CharacterEditor mode="default" />
      </Card>

      <Card hover={false}>
        <h2 className="font-display text-xl text-bark-brown mb-1">Clan rankings</h2>
        <p className="text-sm text-bark-brown-light mb-3">
          Every member&apos;s rank in each boss, skill, EHP and EHB is refreshed from Wise Old Man every morning. Refresh now if you
          want today&apos;s numbers sooner; it takes up to a minute.
        </p>
        <Button size="sm" disabled={refreshing} onClick={refresh}>{refreshing ? "Refreshing..." : "Refresh rankings now"}</Button>
        {result && <p className="mt-2 text-sm text-bark-brown">{result}</p>}
      </Card>
    </div>
  );
}
