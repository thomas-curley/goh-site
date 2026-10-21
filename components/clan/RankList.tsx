"use client";

import { RankBadge } from "@/components/ui/RankBadge";
import { Card } from "@/components/ui/Card";
import { RANKS } from "@/lib/constants";
import { useRankLabels } from "@/components/ui/RankLabelsProvider";

/** Every rank, highest first, with a one-line description (both relabelable in Admin › Rank Labels). */
export function RankList() {
  const { name, description } = useRankLabels();
  return (
    <Card hover={false}>
      <div className="space-y-4">
        {[...RANKS].reverse().map((rank) => (
          <div key={rank.key} className="flex items-start gap-4 pb-4 border-b border-parchment-dark last:border-0 last:pb-0">
            <RankBadge rank={rank.key} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-bark-brown">{name(rank.key)}</p>
              <p className="text-sm text-bark-brown-light">{description(rank.key)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
