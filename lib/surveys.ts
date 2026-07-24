export type QuestionType = "rating" | "multiple_choice" | "text";

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[]; // multiple_choice only
  required: boolean;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  rating: "Rating (1-5)",
  multiple_choice: "Multiple Choice",
  text: "Free Text",
};
