"use client";

import { useState } from "react";
import Link from "next/link";
import { RankBadge } from "@/components/ui/RankBadge";

export interface DirectoryMember {
  displayName: string;
  role: string;
  ehp: number;
  ehb: number;
  exp: number;
}

/** Searchable list of clan members linking to their beta profiles. */
export function MemberDirectory({ members }: { members: DirectoryMember[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = members.filter((m) => !needle || m.displayName.toLowerCase().includes(needle));

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search members..."
        aria-label="Search members"
        className="w-full sm:w-80 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green"
      />
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map((m) => (
          <li key={m.displayName}>
            <Link
              href={`/members/beta/${encodeURIComponent(m.displayName)}`}
              className="card-wood block p-3 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-bark-brown truncate">{m.displayName}</span>
                <RankBadge rank={m.role} className="shrink-0" />
              </div>
              <p className="mt-1 text-xs text-iron-grey tabular-nums">
                {m.ehp.toFixed(0)} EHP · {m.ehb.toFixed(0)} EHB · {(m.exp / 1_000_000).toFixed(1)}M XP
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-sm text-iron-grey">No members match &ldquo;{q}&rdquo;.</p>}
    </div>
  );
}
