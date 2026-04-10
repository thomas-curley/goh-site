import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlayerDetails } from "@/lib/wom";
import { StatsPanel } from "@/components/members/StatsPanel";
import { BossKillsGrid } from "@/components/members/BossKillsGrid";
import { GainsChart } from "@/components/members/GainsChart";
import { Card } from "@/components/ui/Card";
import { formatNumber, getAccountTypeLabel } from "@/lib/utils";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const displayName = decodeURIComponent(username).replace(/\+/g, " ");
  return {
    title: displayName,
    description: `View ${displayName}'s OSRS stats and achievements in Gn0me Home.`,
  };
}

export const revalidate = 3600;

export default async function MemberProfilePage({ params }: Props) {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);
  const player = await getPlayerDetails(decodedUsername);

  if (!player) {
    notFound();
  }

  const snapshot = player.latestSnapshot;
  const skills = snapshot?.data?.skills;
  const bosses = snapshot?.data?.bosses;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Back link */}
      <Link
        href="/members"
        className="inline-flex items-center text-sm text-gnome-green hover:text-gnome-green-light mb-6 gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Members
      </Link>

      {/* Player Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl text-gnome-green">
            {player.displayName}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {player.type !== "regular" && (
              <span className="text-sm font-semibold text-iron-grey">
                {getAccountTypeLabel(player.type)}
              </span>
            )}
            <span className="text-sm text-bark-brown-light">
              Combat Level:{" "}
              <span className="font-stats font-bold text-gnome-green">
                {player.combatLevel}
              </span>
            </span>
          </div>
        </div>
        <a
          href={`https://wiseoldman.net/players/${encodeURIComponent(player.username)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gnome-green hover:text-gnome-green-light underline sm:ml-auto"
        >
          View on Wise Old Man
        </a>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <Card className="text-center" hover={false}>
          <p className="text-xs text-iron-grey uppercase tracking-wide">Total XP</p>
          <p className="font-stats text-2xl font-bold text-gold">{formatNumber(player.exp)}</p>
        </Card>
        <Card className="text-center" hover={false}>
          <p className="text-xs text-iron-grey uppercase tracking-wide">EHP</p>
          <p className="font-stats text-2xl font-bold text-gold">{formatNumber(Math.round(player.ehp))}</p>
        </Card>
        <Card className="text-center" hover={false}>
          <p className="text-xs text-iron-grey uppercase tracking-wide">EHB</p>
          <p className="font-stats text-2xl font-bold text-gold">{formatNumber(Math.round(player.ehb))}</p>
        </Card>
        <Card className="text-center" hover={false}>
          <p className="text-xs text-iron-grey uppercase tracking-wide">TTM</p>
          <p className="font-stats text-2xl font-bold text-gold">{formatNumber(Math.round(player.ttm))}</p>
        </Card>
      </div>

      {/* Gains Chart */}
      <section className="mb-10">
        <GainsChart username={player.username} />
      </section>

      {/* Skills Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section>
          <h2 className="font-display text-2xl text-gnome-green mb-4">Skills</h2>
          {skills ? (
            <StatsPanel skills={skills as unknown as Record<string, { metric: string; level: number; experience: number; rank: number }>} />
          ) : (
            <p className="text-iron-grey text-sm">No snapshot data available.</p>
          )}
        </section>

        {/* Boss Kills */}
        <section>
          <h2 className="font-display text-2xl text-gnome-green mb-4">Boss Kills</h2>
          {bosses ? (
            <BossKillsGrid bosses={bosses as unknown as Record<string, { metric: string; kills: number; rank: number }>} />
          ) : (
            <p className="text-iron-grey text-sm">No boss kill data available.</p>
          )}
        </section>
      </div>
    </div>
  );
}
