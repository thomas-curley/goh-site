import { RankBadge } from "@/components/ui/RankBadge";
import { Card } from "@/components/ui/Card";
import { RANKS } from "@/lib/constants";

const RANK_DESCRIPTIONS: Record<string, string> = {
  owner: "Clan founder — the Owner rank in WOM. Full admin access.",
  council_member: "Clan leadership — Summoner and other council ranks in WOM. Manages events, guides, and clan operations with full admin access.",
  yew: "Experienced and trusted members who contribute actively to the clan.",
  pine: "Established members who participate regularly in events and activities.",
  oak: "Members who have been around a while and proven themselves.",
  gnome_child: "Welcome! New members start here. Join events and get to know us.",
};

/** Every rank, highest first, with a one-line description. */
export function RankList() {
  return (
    <Card hover={false}>
      <div className="space-y-4">
        {[...RANKS].reverse().map((rank) => (
          <div key={rank.key} className="flex items-start gap-4 pb-4 border-b border-parchment-dark last:border-0 last:pb-0">
            <RankBadge rank={rank.name} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-bark-brown">{rank.name}</p>
              <p className="text-sm text-bark-brown-light">{RANK_DESCRIPTIONS[rank.key]}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
