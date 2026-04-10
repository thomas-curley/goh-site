import { getGroupHiscores } from "@/lib/wom";
import { Card } from "@/components/ui/Card";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import type { Metadata } from "next";
import { HiscoresSelector } from "@/components/hiscores/HiscoresSelector";

export const metadata: Metadata = {
  title: "Hiscores",
  description: "Gn0me Home clan leaderboards — top members by skills, bosses, and more.",
};

export const revalidate = 3600;

const DEFAULT_METRICS = [
  { key: "overall", label: "Overall", type: "skill" },
  { key: "slayer", label: "Slayer", type: "skill" },
  { key: "chambers_of_xeric", label: "Chambers of Xeric", type: "boss" },
  { key: "theatre_of_blood", label: "Theatre of Blood", type: "boss" },
  { key: "tombs_of_amascut", label: "Tombs of Amascut", type: "boss" },
  { key: "zulrah", label: "Zulrah", type: "boss" },
];

export default async function HiscoresPage() {
  // Fetch default leaderboards in parallel
  const results = await Promise.all(
    DEFAULT_METRICS.map(async (metric) => {
      const data = await getGroupHiscores(metric.key, 10);
      return { ...metric, entries: data };
    })
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Clan Hiscores</h1>
      <p className="text-bark-brown-light mb-8">
        Top members of Gn0me Home ranked by skills and boss kills. Data from{" "}
        <a
          href="https://wiseoldman.net/groups/24582/hiscores"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gnome-green hover:text-gnome-green-light underline"
        >
          Wise Old Man
        </a>.
      </p>

      {/* Custom metric selector */}
      <HiscoresSelector />

      {/* Default leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {results.map((result) => (
          <LeaderboardCard
            key={result.key}
            label={result.label}
            type={result.type}
            entries={result.entries}
          />
        ))}
      </div>
    </div>
  );
}

function LeaderboardCard({
  label,
  type,
  entries,
}: {
  label: string;
  type: string;
  entries: { player: { displayName: string; username: string }; data: { level?: number; experience?: number; kills?: number; rank: number } }[];
}) {
  return (
    <Card hover={false}>
      <h2 className="font-display text-xl text-gnome-green mb-4">{label}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-iron-grey">No data available.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bark-brown-light text-iron-grey text-xs uppercase tracking-wide">
              <th className="text-left py-2 w-8">#</th>
              <th className="text-left py-2">Player</th>
              <th className="text-right py-2">
                {type === "boss" ? "Kills" : "Level"}
              </th>
              {type === "skill" && <th className="text-right py-2">XP</th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.player.username} className="border-b border-parchment-dark last:border-0">
                <td className="py-2 text-iron-grey font-stats">{i + 1}</td>
                <td className="py-2">
                  <Link
                    href={`/members/${encodeURIComponent(entry.player.username)}`}
                    className="font-mono text-bark-brown hover:text-gnome-green transition-colors"
                  >
                    {entry.player.displayName}
                  </Link>
                </td>
                <td className="py-2 text-right font-stats font-bold text-gnome-green">
                  {type === "boss"
                    ? formatNumber(entry.data.kills ?? 0)
                    : entry.data.level?.toLocaleString() ?? "—"}
                </td>
                {type === "skill" && (
                  <td className="py-2 text-right font-stats text-bark-brown-light">
                    {formatNumber(entry.data.experience ?? 0)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
