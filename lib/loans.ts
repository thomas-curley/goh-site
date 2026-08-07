export type LoanType = "gp" | "item";
export type LoanStatus = "open" | "claimed" | "repaid" | "cancelled";

export interface LoanRequest {
  id: string;
  borrower_id: string;
  loan_type: LoanType;
  gp_amount: string | null;
  item_description: string | null;
  timeframe: string;
  purpose: string | null;
  collateral_offered: string;
  collateral_value: string | null;
  previous_loans: string | null;
  repayment_plan: string | null;
  additional_notes: string | null;
  agreed_terms: boolean;
  status: LoanStatus;
  lender_id: string | null;
  claimed_at: string | null;
  repaid_at: string | null;
  created_at: string;
  updated_at: string;
}

export const LOAN_TIMEFRAMES = [
  "1-3 days",
  "1 week",
  "2 weeks",
  "1 month+",
] as const;

export const LOAN_PURPOSES = [
  "PvM supplies",
  "Skilling investment",
  "Merchanting",
  "Quest requirement",
  "Other",
] as const;

export const PREVIOUS_LOAN_OPTIONS = [
  "No, first time",
  "Yes, repaid successfully",
  "Yes, had issues before",
] as const;

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  open: "Open",
  claimed: "Claimed",
  repaid: "Repaid",
  cancelled: "Cancelled",
};
