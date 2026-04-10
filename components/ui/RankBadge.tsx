import { Badge } from "./Badge";
import { getRankByName } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface RankBadgeProps {
  rank: string;
  className?: string;
}

export function RankBadge({ rank, className }: RankBadgeProps) {
  const rankDef = getRankByName(rank);
  const displayName = rankDef?.name ?? rank;
  const colorClass = rankDef?.color ?? "bg-gray-200 text-gray-800";

  return (
    <Badge className={cn(colorClass, className)}>
      {displayName}
    </Badge>
  );
}
