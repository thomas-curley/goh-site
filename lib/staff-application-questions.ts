export interface StaffApplicationQuestion {
  key: string;
  label: string;
}

export const STAFF_APPLICATION_QUESTIONS: StaffApplicationQuestion[] = [
  { key: "why", label: "Why do you want to join staff?" },
  { key: "experience", label: "What relevant experience do you have (moderation, running events, etc.)?" },
  { key: "availability", label: "How many hours per week can you realistically commit?" },
  { key: "other", label: "Anything else we should know?" },
];
