import type { SupabaseClient } from "@supabase/supabase-js";
import { getGroupMembers } from "@/lib/wom";

export type QuestionType = "rating" | "multiple_choice" | "text" | "likert";

export type LikertScale = 3 | 5;

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[]; // multiple_choice only
  allowMultiple?: boolean; // multiple_choice only -- render as checkboxes, store an array of answers
  scale?: LikertScale; // likert only -- defaults to 5
  required: boolean;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  rating: "Rating (1-5)",
  multiple_choice: "Multiple Choice",
  text: "Free Text",
  likert: "Agreement Scale (Likert)",
};

// Labels for each point on a Likert agreement scale, indexed 0..scale-1.
export const LIKERT_LABELS: Record<LikertScale, string[]> = {
  3: ["Disagree", "Neutral", "Agree"],
  5: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
};

export type AccessLevel = "anonymous" | "verified_player" | "clan_member";

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  anonymous: "Anonymous (default)",
  verified_player: "Verified Player (RSN linked)",
  clan_member: "Clan Member Only",
};

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  verifiedName?: string;
  discordId?: string;
}

/** WOM display names and stored RSNs vary in spacing/casing -- normalize before matching. */
function normalizeRsn(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Whether the given (already-authenticated-or-not) user is allowed to take
 * a survey with this access level. Shared by the survey GET route (a
 * pre-check so the take-survey page can show a gate screen before anyone
 * fills anything out) and the response POST route (the real enforcement --
 * never trust the client's earlier GET check alone). `userId` is the
 * caller's own already-resolved `auth.getUser()` id, or null if signed out.
 */
export async function checkSurveyEligibility(
  supabase: SupabaseClient,
  accessLevel: AccessLevel,
  userId: string | null
): Promise<EligibilityResult> {
  if (accessLevel === "anonymous") return { eligible: true };

  if (!userId) {
    return { eligible: false, reason: "You must be signed in to take this survey." };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("discord_id, rsn, rsn_verified")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.rsn || !profile.rsn_verified) {
    return { eligible: false, reason: "Link and verify your RSN on your Account page first." };
  }

  if (accessLevel === "clan_member") {
    const members = await getGroupMembers();
    const normalized = normalizeRsn(profile.rsn);
    const inClan = members.some((m) => normalizeRsn(m.displayName) === normalized);
    if (!inClan) {
      return { eligible: false, reason: "You must be a current clan member to take this survey." };
    }
  }

  return { eligible: true, verifiedName: profile.rsn, discordId: profile.discord_id };
}
