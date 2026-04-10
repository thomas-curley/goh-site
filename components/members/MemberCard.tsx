import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { RankBadge } from "@/components/ui/RankBadge";
import type { ClanMember } from "@/lib/wom";
import { formatNumber, getAccountTypeLabel, getAccountTypeColor, cn } from "@/lib/utils";

interface MemberCardProps {
  member: ClanMember;
}

export function MemberCard({ member }: MemberCardProps) {
  const accountLabel = getAccountTypeLabel(member.type);
  const accountColor = getAccountTypeColor(member.type);

  return (
    <Link href={`/members/${encodeURIComponent(member.username)}`}>
      <Card className="flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-base font-bold text-bark-brown truncate">
            {member.displayName}
          </h3>
          <RankBadge rank={member.role} />
        </div>

        {member.type !== "regular" && (
          <span className={cn("text-xs font-semibold", accountColor)}>
            {accountLabel}
          </span>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-sm">
          <div>
            <span className="text-iron-grey">XP: </span>
            <span className="font-stats font-bold text-gnome-green">
              {formatNumber(member.exp)}
            </span>
          </div>
          <div>
            <span className="text-iron-grey">TTM: </span>
            <span className="font-stats font-bold text-gnome-green">
              {formatNumber(Math.round(member.ttm))}
            </span>
          </div>
          <div>
            <span className="text-iron-grey">EHP: </span>
            <span className="font-stats text-bark-brown">
              {formatNumber(Math.round(member.ehp))}
            </span>
          </div>
          <div>
            <span className="text-iron-grey">EHB: </span>
            <span className="font-stats text-bark-brown">
              {formatNumber(Math.round(member.ehb))}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
