import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { RankBadge } from "@/components/ui/RankBadge";
import { GainsPanel, type GainsSet } from "@/components/profiles/GainsPanel";
import { ParseBadge } from "@/components/profiles/ParseBadge";
import { CharacterStage } from "@/components/profiles/CharacterStage";
import type { Character } from "@/lib/osrs-character";
import { ordinal } from "@/lib/profiles-format";

export interface RankInfo {
  rank: number;
  count: number;
}

export interface ProfileData {
  displayName: string;
  accountType: string | null;
  clanRole: string | null;
  portraitUrl: string | null;
  character: Character;
  usesDefaultCharacter: boolean;
  summary: { label: string; value: string; rank: RankInfo | null }[];
  bosses: { key: string; name: string; kc: number; rank: RankInfo | null }[];
  skills: { key: string; name: string; level: number; xp: number; rank: RankInfo | null }[];
  gains: { week: GainsSet | null; month: GainsSet | null };
  statsUpdatedAt: string | null;
  rankingsUpdatedAt: string | null;
  womUrl: string;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never";
}

const PARSE_LEGEND = [
  { label: "100", bg: "#e5cc80", fg: "#3b2f05" },
  { label: "99", bg: "#e268a8", fg: "#fff" },
  { label: "95+", bg: "#ff8000", fg: "#1f1000" },
  { label: "75+", bg: "#a335ee", fg: "#fff" },
  { label: "50+", bg: "#0070dd", fg: "#fff" },
  { label: "25+", bg: "#1eaa3a", fg: "#fff" },
  { label: "0+", bg: "#6b6b6b", fg: "#fff" },
];

/**
 * A member's "logs"-style profile: their 3D character and gear, the
 * headline numbers, every boss and skill coloured by where they rank in the
 * clan, and recent gains.
 */
export function ProfileView({ data }: { data: ProfileData }) {
  const rankedBosses = data.bosses.filter((b) => b.kc > 0).sort((a, b) => b.kc - a.kc);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link href="/members/beta" className="text-gnome-green hover:underline">&larr; All profiles</Link>
        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-bark-brown">Beta · staff only</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* Character */}
        <div className="space-y-2 min-w-0">
          <CharacterStage
            character={data.character}
            title={
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  {data.portraitUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.portraitUrl} alt="" className="w-8 h-8 rounded-full border border-gold" />
                  )}
                  <h1 className="font-display text-3xl text-gold-light leading-tight drop-shadow">{data.displayName}</h1>
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  {data.clanRole && <RankBadge rank={data.clanRole} />}
                  {data.accountType && data.accountType !== "regular" && (
                    <span className="rounded-full border border-parchment/40 px-2 py-0.5 text-parchment/90 capitalize">{data.accountType.replace(/_/g, " ")}</span>
                  )}
                </div>
              </div>
            }
          />
          <p className="text-xs text-iron-grey text-center">
            {data.usesDefaultCharacter ? "Wearing the clan's gnome fashionscape." : "Their own character."} Drag to turn. Make yours in{" "}
            <Link href="/account#outfit" className="text-gnome-green hover:underline">My Account</Link>.
          </p>
        </div>

        {/* Summary */}
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {data.summary.map((s) => (
              <Card key={s.label} hover={false} className="!p-3">
                <p className="text-[11px] uppercase tracking-wide text-iron-grey">{s.label}</p>
                <p className="font-stats text-2xl font-bold text-bark-brown tabular-nums leading-tight">{s.value}</p>
                {s.rank ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-iron-grey">
                    <ParseBadge rank={s.rank.rank} count={s.rank.count} size="sm" />
                    {ordinal(s.rank.rank)} of {s.rank.count}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-iron-grey">&nbsp;</p>
                )}
              </Card>
            ))}
          </div>

          <Card hover={false}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-display text-xl text-gnome-green">Recent gains</h2>
            </div>
            <GainsPanel week={data.gains.week} month={data.gains.month} />
          </Card>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-iron-grey">
            <span>Clan percentile:</span>
            {PARSE_LEGEND.map((l) => (
              <span key={l.label} className="rounded px-1.5 font-bold" style={{ backgroundColor: l.bg, color: l.fg }}>{l.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bosses */}
        <Card hover={false} className="min-w-0">
          <h2 className="font-display text-xl text-gnome-green mb-3">Bosses</h2>
          {rankedBosses.length === 0 ? (
            <p className="text-sm text-iron-grey">No boss kills on the hiscores yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-iron-grey">
                    <th className="pb-2 font-semibold">Boss</th>
                    <th className="pb-2 font-semibold text-right">Kills</th>
                    <th className="pb-2 font-semibold text-right">Clan rank</th>
                    <th className="pb-2 font-semibold text-right w-12">%</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedBosses.map((b) => (
                    <tr key={b.key} className="border-t border-parchment-dark/60">
                      <td className="py-1.5 text-bark-brown">{b.name}</td>
                      <td className="py-1.5 text-right tabular-nums text-bark-brown">{b.kc.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-iron-grey">{b.rank ? `${ordinal(b.rank.rank)} / ${b.rank.count}` : "—"}</td>
                      <td className="py-1.5 text-right">{b.rank ? <ParseBadge rank={b.rank.rank} count={b.rank.count} size="sm" /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Skills */}
        <Card hover={false} className="min-w-0">
          <h2 className="font-display text-xl text-gnome-green mb-3">Skills</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {data.skills.map((s) => (
              <li key={s.key} className="flex items-center gap-2 border-t border-parchment-dark/60 py-1.5 text-sm">
                <span className="flex-1 min-w-0 truncate text-bark-brown">{s.name}</span>
                <span className="tabular-nums font-semibold text-bark-brown w-8 text-right">{s.level}</span>
                <span className="tabular-nums text-xs text-iron-grey w-16 text-right">{s.xp >= 1_000_000 ? `${(s.xp / 1_000_000).toFixed(1)}M` : `${Math.round(s.xp / 1000)}K`}</span>
                {s.rank ? <ParseBadge rank={s.rank.rank} count={s.rank.count} size="sm" /> : <span className="w-8" />}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="text-xs text-iron-grey">
        Stats from <a href={data.womUrl} target="_blank" rel="noreferrer" className="text-gnome-green hover:underline">Wise Old Man</a> (updated {formatDate(data.statsUpdatedAt)}).
        Clan ranks refresh daily (last {formatDate(data.rankingsUpdatedAt)}). Percentile 100 = best in the clan; members with no progress in a boss or skill aren&apos;t ranked in it.
      </p>
    </div>
  );
}
