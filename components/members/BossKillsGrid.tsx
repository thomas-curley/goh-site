interface BossEntry {
  metric: string;
  kills: number;
  rank: number;
}

interface BossKillsGridProps {
  bosses: Record<string, BossEntry>;
}

const BOSS_DISPLAY_NAMES: Record<string, string> = {
  abyssal_sire: "Abyssal Sire",
  alchemical_hydra: "Alchemical Hydra",
  araxxor: "Araxxor",
  artio: "Artio",
  barrows_chests: "Barrows",
  bryophyta: "Bryophyta",
  callisto: "Callisto",
  calvarion: "Calvar'ion",
  cerberus: "Cerberus",
  chambers_of_xeric: "Chambers of Xeric",
  chambers_of_xeric_challenge_mode: "CoX (CM)",
  chaos_elemental: "Chaos Elemental",
  chaos_fanatic: "Chaos Fanatic",
  commander_zilyana: "Zilyana",
  corporeal_beast: "Corp Beast",
  crazy_archaeologist: "Crazy Archaeologist",
  dagannoth_prime: "DK Prime",
  dagannoth_rex: "DK Rex",
  dagannoth_supreme: "DK Supreme",
  deranged_archaeologist: "Deranged Archaeologist",
  duke_sucellus: "Duke Sucellus",
  general_graardor: "Graardor",
  giant_mole: "Giant Mole",
  grotesque_guardians: "Grotesque Guardians",
  hespori: "Hespori",
  kalphite_queen: "Kalphite Queen",
  king_black_dragon: "KBD",
  kraken: "Kraken",
  kreearra: "Kree'arra",
  kril_tsutsaroth: "K'ril Tsutsaroth",
  lunar_chests: "Lunar Chests",
  mimic: "Mimic",
  nex: "Nex",
  nightmare: "Nightmare",
  phosanis_nightmare: "Phosani's Nightmare",
  obor: "Obor",
  phantom_muspah: "Phantom Muspah",
  sarachnis: "Sarachnis",
  scorpia: "Scorpia",
  scurrius: "Scurrius",
  skotizo: "Skotizo",
  sol_heredit: "Sol Heredit",
  spindel: "Spindel",
  tempoross: "Tempoross",
  the_gauntlet: "Gauntlet",
  the_corrupted_gauntlet: "Corrupted Gauntlet",
  the_leviathan: "The Leviathan",
  the_whisperer: "The Whisperer",
  theatre_of_blood: "Theatre of Blood",
  theatre_of_blood_hard_mode: "ToB (HM)",
  thermonuclear_smoke_devil: "Thermy",
  tombs_of_amascut: "Tombs of Amascut",
  tombs_of_amascut_expert: "ToA (Expert)",
  tzkal_zuk: "TzKal-Zuk",
  tztok_jad: "TzTok-Jad",
  vardorvis: "Vardorvis",
  venenatis: "Venenatis",
  vetion: "Vet'ion",
  vorkath: "Vorkath",
  wintertodt: "Wintertodt",
  zalcano: "Zalcano",
  zulrah: "Zulrah",
};

export function BossKillsGrid({ bosses }: BossKillsGridProps) {
  const tracked = Object.entries(bosses)
    .filter(([, data]) => data.kills > 0)
    .sort(([, a], [, b]) => b.kills - a.kills);

  if (tracked.length === 0) {
    return (
      <p className="text-iron-grey text-sm">No boss kills tracked yet.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {tracked.map(([key, data]) => (
        <div key={key} className="card-wood px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-xs text-bark-brown-light truncate">
            {BOSS_DISPLAY_NAMES[key] ?? key.replace(/_/g, " ")}
          </span>
          <span className="font-stats font-bold text-sm text-gnome-green">
            {data.kills.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
