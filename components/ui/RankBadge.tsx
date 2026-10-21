"use client";

import { Badge } from "./Badge";
import { getRankByName } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useRankLabels } from "./RankLabelsProvider";

interface RankBadgeProps {
  rank: string;
  className?: string;
}

export function RankBadge({ rank, className }: RankBadgeProps) {
  const { name } = useRankLabels();
  const rankDef = getRankByName(rank);
  const colorClass = rankDef?.color ?? "bg-gray-200 text-gray-800";

  return (
    <Badge className={cn(colorClass, className)}>
      {name(rank)}
    </Badge>
  );
}
