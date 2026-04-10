"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

const SKILL_OPTIONS = [
  "overall", "attack", "defence", "strength", "hitpoints", "ranged", "prayer",
  "magic", "cooking", "woodcutting", "fletching", "fishing", "firemaking",
  "crafting", "smithing", "mining", "herblore", "agility", "thieving", "slayer",
  "farming", "runecrafting", "hunter", "construction",
];

const BOSS_OPTIONS = [
  "chambers_of_xeric", "theatre_of_blood", "tombs_of_amascut",
  "tombs_of_amascut_expert", "zulrah", "vorkath", "nex",
  "the_corrupted_gauntlet", "the_gauntlet", "alchemical_hydra",
  "cerberus", "general_graardor", "kreearra", "commander_zilyana",
  "kril_tsutsaroth", "corporeal_beast", "kalphite_queen", "giant_mole",
  "phantom_muspah", "vardorvis", "the_leviathan", "the_whisperer",
  "duke_sucellus", "araxxor", "barrows_chests", "dagannoth_prime",
  "dagannoth_rex", "dagannoth_supreme", "nightmare", "kraken",
  "thermonuclear_smoke_devil", "grotesque_guardians", "scorpia",
  "sarachnis", "tempoross", "wintertodt", "zalcano",
];

const COMPUTED_OPTIONS = ["ehp", "ehb"];

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Kril Tsutsaroth", "K'ril Tsutsaroth")
    .replace("Kreearra", "Kree'arra")
    .replace("The ", "");
}

interface HiscoreEntry {
  player: { displayName: string; username: string };
  data: { level?: number; experience?: number; kills?: number; score?: number; rank: number; value?: number };
}

export function HiscoresSelector() {
  const [category, setCategory] = useState<"skill" | "boss" | "computed">("skill");
  const [metric, setMetric] = useState("overall");
  const [results, setResults] = useState<HiscoreEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const options = category === "skill" ? SKILL_OPTIONS : category === "boss" ? BOSS_OPTIONS : COMPUTED_OPTIONS;

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.wiseoldman.net/v2/groups/24582/hiscores?metric=${metric}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const isBoss = category === "boss";
  const isComputed = category === "computed";

  return (
    <Card hover={false}>
      <h2 className="font-display text-lg text-bark-brown mb-4">Custom Lookup</h2>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={category}
          onChange={(e) => {
            const cat = e.target.value as "skill" | "boss" | "computed";
            setCategory(cat);
            setMetric(cat === "skill" ? "overall" : cat === "boss" ? "chambers_of_xeric" : "ehp");
            setResults(null);
          }}
          className="px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
        >
          <option value="skill">Skills</option>
          <option value="boss">Bosses</option>
          <option value="computed">EHP / EHB</option>
        </select>
        <select
          value={metric}
          onChange={(e) => { setMetric(e.target.value); setResults(null); }}
          className="flex-1 px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{formatLabel(opt)}</option>
          ))}
        </select>
        <Button onClick={handleSearch} disabled={loading} size="sm">
          {loading ? "Loading..." : "Search"}
        </Button>
      </div>

      {results && results.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bark-brown-light text-iron-grey text-xs uppercase tracking-wide">
              <th className="text-left py-2 w-8">#</th>
              <th className="text-left py-2">Player</th>
              <th className="text-right py-2">
                {isBoss ? "Kills" : isComputed ? "Value" : "Level"}
              </th>
              {!isBoss && !isComputed && <th className="text-right py-2">XP</th>}
            </tr>
          </thead>
          <tbody>
            {results.map((entry, i) => (
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
                  {isBoss
                    ? formatNumber(entry.data.kills ?? 0)
                    : isComputed
                      ? formatNumber(Math.round(entry.data.value ?? 0))
                      : entry.data.level?.toLocaleString() ?? "—"}
                </td>
                {!isBoss && !isComputed && (
                  <td className="py-2 text-right font-stats text-bark-brown-light">
                    {formatNumber(entry.data.experience ?? 0)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {results && results.length === 0 && (
        <p className="text-sm text-iron-grey text-center py-4">No data for this metric.</p>
      )}
    </Card>
  );
}
