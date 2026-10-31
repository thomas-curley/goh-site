// Art contests: shared types, labels and result maths (server and pages).

export type ArtContestStatus = "draft" | "submissions" | "review" | "voting" | "completed";
export type ArtEntryStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type CommentsVisibility = "live" | "after" | "private" | "off";

export interface ArtContest {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  theme: string | null;
  banner_url: string | null;
  status: ArtContestStatus;
  submissions_close_at: string | null;
  voting_close_at: string | null;
  submit_eligibility: "clan" | "signed_in";
  entry_visibility: "public" | "clan";
  max_entries_per_person: number;
  max_images_per_entry: number;
  votes_per_voter: number;
  vote_eligibility: "clan" | "signed_in" | "ip";
  show_live_results: boolean;
  comments_visibility: CommentsVisibility;
  anonymous_voting: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArtEntry {
  id: string;
  contest_id: string | null;
  user_id: string | null;
  rsn: string | null;
  title: string;
  description: string | null;
  image_paths: string[];
  visibility: "public" | "clan";
  credit: "rsn" | "custom" | "anonymous";
  credit_name: string | null;
  gallery_opt_in: boolean;
  agreed_rules: boolean;
  status: ArtEntryStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  gallery_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export const CONTEST_STATUS_LABELS: Record<ArtContestStatus, string> = {
  draft: "Draft",
  submissions: "Taking entries",
  review: "Entries closed, judging",
  voting: "Voting open",
  completed: "Finished",
};

export const ENTRY_STATUS_LABELS: Record<ArtEntryStatus, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};

export const COMMENTS_LABELS: Record<CommentsVisibility, string> = {
  live: "Shown on the entry straight away",
  after: "Shown on the entry once voting ends",
  private: "Only staff and the artist see them",
  off: "No comments",
};

/** How the artist is shown: their RSN, the name they picked, or "Anonymous". */
export function creditName(entry: Pick<ArtEntry, "credit" | "credit_name" | "rsn">): string {
  if (entry.credit === "custom" && entry.credit_name?.trim()) return entry.credit_name.trim();
  if (entry.credit === "rsn" && entry.rsn) return entry.rsn;
  return "Anonymous";
}

export interface EntryResult {
  entryId: string;
  votes: number;
  rank: number;
}

/** Vote counts, most first; tied entries share a rank. */
export function rankEntries(entryIds: string[], votes: { entry_id: string }[]): EntryResult[] {
  const counts = new Map(entryIds.map((id) => [id, 0]));
  for (const v of votes) if (counts.has(v.entry_id)) counts.set(v.entry_id, (counts.get(v.entry_id) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  let rank = 0;
  let last = -1;
  return sorted.map(([entryId, n], i) => {
    if (n !== last) {
      rank = i + 1;
      last = n;
    }
    return { entryId, votes: n, rank };
  });
}
