import { RankBadge } from "@/components/ui/RankBadge";
import { Card } from "@/components/ui/Card";
import { RANKS } from "@/lib/constants";

const RANK_DESCRIPTIONS: Record<string, string> = {
  gold_key: "Clan owner — the Owner rank in game and on Wise Old Man, shown with a gold key. Full admin access.",
  silver_key: "Deputy owners — the Deputy Owner rank, shown with a silver key. Run the clan alongside the Gold Key.",
  yew: "Experienced and trusted members who contribute actively to the clan.",
  pine: "Established members who participate regularly in events and activities.",
  oak: "Members who have been around a while and proven themselves.",
  council: "Council — the Summoner rank in game. Helps out with events and looking after members.",
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
