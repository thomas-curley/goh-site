"use client";

import { useState, useMemo } from "react";
import { MemberCard } from "./MemberCard";
import type { ClanMember } from "@/lib/wom";
import { getRankOrder } from "@/lib/constants";

type SortField = "rank" | "exp" | "ehp" | "ehb";

interface MemberGridProps {
  members: ClanMember[];
}

export function MemberGrid({ members }: MemberGridProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("rank");

  const filtered = useMemo(() => {
    let result = members;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) =>
        m.displayName.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "rank": {
          const rankDiff = getRankOrder(b.role) - getRankOrder(a.role);
          return rankDiff !== 0 ? rankDiff : b.exp - a.exp;
        }
        case "exp":
          return b.exp - a.exp;
        case "ehp":
          return b.ehp - a.ehp;
        case "ehb":
          return b.ehb - a.ehb;
        default:
          return 0;
      }
    });

    return result;
  }, [members, search, sortBy]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <input
          type="text"
          placeholder="Search by RSN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-md border border-bark-brown-light bg-parchment text-text-primary placeholder:text-iron-grey focus:outline-none focus:ring-2 focus:ring-gnome-green font-mono"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortField)}
          className="px-4 py-2.5 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
        >
          <option value="rank">Sort by Rank</option>
          <option value="exp">Sort by Total XP</option>
          <option value="ehp">Sort by EHP</option>
          <option value="ehb">Sort by EHB</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-iron-grey mb-4">
        Showing {filtered.length} of {members.length} members
      </p>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((member) => (
            <MemberCard key={member.username} member={member} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-iron-grey">
          <p className="font-display text-xl">No members found</p>
          <p className="text-sm mt-2">
            {search ? "Try a different search term." : "Could not load member data."}
          </p>
        </div>
      )}
    </div>
  );
}
