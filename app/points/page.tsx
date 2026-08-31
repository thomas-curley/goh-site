import { createClient } from "@supabase/supabase-js";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import { getPointsLeaderboard } from "@/lib/clan-points";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clan Points",
  description: "Points leaderboard, fed by the Gn0me Home RuneLite plugin.",
};

export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function PointsPage() {
  if (!(await checkSectionAccess("points"))) return <SectionUnavailable />;

  const supabase = getServiceClient();
  const leaderboard = supabase ? await getPointsLeaderboard(supabase, 50) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Clan Points</h1>
      <p className="text-sm text-bark-brown-light mb-8">
        Earned automatically by the Gn0me Home RuneLite plugin -- level-ups, quest completions, boss KC
        milestones, clue scrolls, and pet drops.
      </p>

      {leaderboard.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-bark-brown-light">No points earned yet -- install the RuneLite plugin and get started!</p>
        </Card>
      ) : (
        <Card hover={false}>
          <ol className="divide-y divide-parchment-dark">
            {leaderboard.map((row, i) => (
              <li key={row.userId} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-right font-display text-bark-brown-light">{i + 1}</span>
                  <span className="font-mono font-bold text-bark-brown">{row.rsn}</span>
                </div>
                <span className="font-display text-gnome-green">{row.points.toLocaleString()} pts</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
