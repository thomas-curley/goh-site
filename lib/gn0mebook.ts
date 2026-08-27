import { createClient } from "@supabase/supabase-js";
import { getRankOrder } from "@/lib/constants";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface SocialLink {
  label: string;
  url: string;
}

// A fixed, restricted set -- no free-text option. "Prefer not to answer" is
// mutually exclusive with the rest (see ProfileEditForm's togglePronoun);
// the others can be combined, since someone can use more than one set (e.g.
// "She/Her, They/Them"), stored as a comma-separated string in
// member_profiles.pronouns.
export const PRONOUN_OPTIONS = ["She/Her", "He/Him", "They/Them", "Any pronouns"] as const;
export const PRONOUN_PREFER_NOT_TO_ANSWER = "Prefer not to answer";

export interface MemberProfile {
  id: string;
  user_id: string;
  pronouns: string | null;
  tagline: string | null;
  about: string | null;
  interests: string | null;
  play_schedule: string | null;
  in_game_focus: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  social_links: SocialLink[];
  is_published: boolean;
  visibility: "anonymous" | "verified_player" | "clan_member";
  hidden_by_admin: boolean;
  created_at: string;
  updated_at: string;
  // Joined from user_profiles for display -- never editable here.
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  rsn: string | null;
  clan_rank: string | null;
}

const PROFILE_SELECT = "*, user_profiles!inner(discord_id, discord_username, discord_avatar, rsn, clan_rank)";

// Supabase returns the joined row nested under the FK table name -- flatten
// it into the shape callers actually want to work with.
function flatten(row: Record<string, unknown>): MemberProfile {
  const joined = row.user_profiles as Record<string, unknown>;
  const { user_profiles: _drop, ...rest } = row;
  void _drop;
  return {
    ...(rest as Omit<MemberProfile, "discord_id" | "discord_username" | "discord_avatar" | "rsn" | "clan_rank">),
    discord_id: joined?.discord_id as string,
    discord_username: joined?.discord_username as string,
    discord_avatar: (joined?.discord_avatar as string | null) ?? null,
    rsn: (joined?.rsn as string | null) ?? null,
    clan_rank: (joined?.clan_rank as string | null) ?? null,
  };
}

/** Every published, non-hidden profile, staff (Council Member) first. Used by the public directory. */
export async function getPublishedProfiles(): Promise<MemberProfile[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("member_profiles")
    .select(PROFILE_SELECT)
    .eq("is_published", true)
    .eq("hidden_by_admin", false);

  if (error || !data) return [];

  const profiles = data.map((row) => flatten(row as Record<string, unknown>));
  return profiles.sort((a, b) => {
    const rankDiff = getRankOrder(b.clan_rank ?? "") - getRankOrder(a.clan_rank ?? "");
    return rankDiff !== 0 ? rankDiff : a.discord_username.localeCompare(b.discord_username);
  });
}

/** A single profile by its own id, for the public profile page (regardless of publish/hidden state -- the page itself decides what to show). */
export async function getProfileById(id: string): Promise<MemberProfile | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data } = await supabase.from("member_profiles").select(PROFILE_SELECT).eq("id", id).maybeSingle();
  return data ? flatten(data as Record<string, unknown>) : null;
}

/** A single profile by its owner's auth user id, for the self-service editor. */
export async function getProfileByUserId(userId: string): Promise<MemberProfile | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data } = await supabase.from("member_profiles").select(PROFILE_SELECT).eq("user_id", userId).maybeSingle();
  return data ? flatten(data as Record<string, unknown>) : null;
}
