"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

interface PendingItem {
  key: string;
  label: string;
  href: string;
  count: number;
}

/** Dashboard panel: everything waiting on staff that the viewer can act on, each linking to its page. */
export function NeedsAttention() {
  const [items, setItems] = useState<PendingItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/pending")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) return null;
  const waiting = items.filter((i) => i.count > 0);

  return (
    <Card hover={false} className="mb-8">
      <h2 className="font-display text-lg text-bark-brown mb-3">Needs Attention</h2>
      {waiting.length === 0 ? (
        <p className="text-sm text-iron-grey">All caught up — nothing waiting on staff. 🌿</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {waiting.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-parchment-dark/40 hover:bg-parchment-dark text-sm text-bark-brown transition-colors"
            >
              <span>{item.label}</span>
              <span className="min-w-6 px-2 rounded-full bg-red-accent text-white text-xs font-semibold leading-6 text-center">{item.count}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
