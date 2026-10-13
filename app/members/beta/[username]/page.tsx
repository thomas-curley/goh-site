import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { SKILLS, BOSSES, SkillProps, BossProps } from "@wise-old-man/utils";
import { getGroupMembers, getPlayerDetails, getPlayerGains, normalizeRsn } from "@/lib/wom";
import { getMemberRankings, type MemberRanking } from "@/lib/clan-rankings";
import { getDefaultOutfit, getUserOutfit, mergeOutfit } from "@/lib/profile-outfits";
import { checkStaffViewer } from "@/lib/staff-gate";
import { ProfileView, type ProfileData, type RankInfo } from "@/components/profiles/ProfileView";
import type { GainsSet } from "@/components/profiles/GainsPanel";
import { StaffOnly } from "@/components/profiles/StaffOnly";
import type { Outfit } from "@/lib/profiles-format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `${decodeURIComponent(username)} · Profile (Beta)` };
}

function rankOf(r: MemberRanking | undefined): RankInfo | null {
  return r ? { rank: r.clan_rank, count: r.ranked_count } : null;
}

type Gains = NonNullable<Awaited<ReturnType<typeof getPlayerGains>>>;

function toGainsSet(gains: Gains | null): GainsSet | null {
  if (!gains) return null;
  const d = gains.data;
  const skills = SKILLS.filter((s) => s !== "overall")
    .map((s) => ({ name: SkillProps[s].name, gained: d.skills[s]?.experience.gained ?? 0, unit: "xp" as const }))
    .filter((r) => r.gained > 0)
    .sort((a, b) => b.gained - a.gained)
    .slice(0, 8);
  const bosses = BOSSES.map((b) => ({ name: BossProps[b].name, gained: d.bosses[b]?.kills.gained ?? 0, unit: "kc" as const }))
    .filter((r) => r.gained > 0)
    .sort((a, b) => b.gained - a.gained)
    .slice(0, 8);
  return { skills, bosses, ehp: d.computed.ehp?.value.gained ?? 0, ehb: d.computed.ehb?.value.gained ?? 0 };
}

function compact(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString();
}

// /members/beta/<rsn> -- staff-only "logs"-style member profile (beta).
export default async function MemberProfileBetaPage({ params }: Params) {
  const access = await checkStaffViewer("member profiles (beta)");
  if (!access.eligible) return <StaffOnly title="Member Profiles (Beta)" reason={access.reason} />;

  const { username } = await params;
  const rsn = decodeURIComponent(username);
  const player = await getPlayerDetails(rsn);
  if (!player) notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = url && key ? createClient(url, key) : null;

  const [rankings, week, month, members, linked, defaultOutfit] = await Promise.all([
    supabase ? getMemberRankings(supabase, player.displayName) : Promise.resolve(new Map<string, MemberRanking>()),
    getPlayerGains(player.username, "week"),
    getPlayerGains(player.username, "month"),
    getGroupMembers(),
    supabase
      ? supabase.from("user_profiles").select("id, discord_avatar").ilike("rsn", player.displayName).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    supabase ? getDefaultOutfit(supabase) : Promise.resolve({} as Outfit),
  ]);

  const own = supabase && linked?.id ? await getUserOutfit(supabase, linked.id) : {};
  const { outfit, usesDefault } = mergeOutfit(own, defaultOutfit);
  const clanRole = members.find((m) => normalizeRsn(m.displayName) === normalizeRsn(player.displayName))?.role ?? null;

  const skillsData = player.latestSnapshot?.data.skills;
  const bossesData = player.latestSnapshot?.data.bosses;
  const overall = skillsData?.overall;
  const capturedAt = [...rankings.values()][0]?.captured_at ?? null;

  const data: ProfileData = {
    displayName: player.displayName,
    accountType: player.type,
    clanRole,
    portraitUrl: linked?.discord_avatar ?? null,
    outfit,
    usesDefaultOutfit: usesDefault,
    summary: [
      { label: "Total level", value: overall ? overall.level.toLocaleString() : "—", rank: rankOf(rankings.get("overall")) },
      { label: "Total XP", value: overall ? compact(overall.experience) : "—", rank: rankOf(rankings.get("overall")) },
      { label: "Combat", value: String(player.combatLevel ?? "—"), rank: null },
      { label: "EHP", value: player.ehp.toFixed(1), rank: rankOf(rankings.get("ehp")) },
      { label: "EHB", value: player.ehb.toFixed(1), rank: rankOf(rankings.get("ehb")) },
    ],
    bosses: BOSSES.map((b) => ({ key: b, name: BossProps[b].name, kc: Math.max(0, bossesData?.[b]?.kills ?? 0), rank: rankOf(rankings.get(b)) })),
    skills: SKILLS.filter((s) => s !== "overall").map((s) => ({
      key: s,
      name: SkillProps[s].name,
      level: skillsData?.[s]?.level ?? 1,
      xp: Math.max(0, skillsData?.[s]?.experience ?? 0),
      rank: rankOf(rankings.get(s)),
    })),
    gains: { week: toGainsSet(week), month: toGainsSet(month) },
    statsUpdatedAt: player.updatedAt ? new Date(player.updatedAt).toISOString() : null,
    rankingsUpdatedAt: capturedAt,
    womUrl: `https://wiseoldman.net/players/${encodeURIComponent(player.username)}`,
  };

  return <ProfileView data={data} />;
}
