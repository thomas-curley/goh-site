import type { SupabaseClient } from "@supabase/supabase-js";
import { checkClanEligibility, type AccessLevel } from "@/lib/clan-access";

export type { AccessLevel, EligibilityResult } from "@/lib/clan-access";
export { ACCESS_LEVEL_LABELS } from "@/lib/clan-access";

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

/**
 * Thin survey-flavored wrapper around the shared clan-access check (see
 * lib/clan-access.ts for the actual logic -- it's identical for every
 * gated feature, not survey-specific). Kept under this name/location since
 * every existing survey call site already imports it from here.
 */
export async function checkSurveyEligibility(
  supabase: SupabaseClient,
  accessLevel: AccessLevel,
  userId: string | null
) {
  return checkClanEligibility(supabase, accessLevel, userId, "this survey");
}
