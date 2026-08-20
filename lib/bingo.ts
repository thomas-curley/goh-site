export const GRID_SIZES = [3, 4, 5, 6] as const;

export type BingoEventStatus = "draft" | "active" | "completed";
export type BingoTileTrackingType = "wom" | "manual";
export type BingoTileCompletionStatus = "incomplete" | "pending_review" | "completed";

export interface BingoEvent {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  grid_size: number;
  status: BingoEventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BingoTeamMember {
  id: string;
  team_id: string;
  rsn: string;
  user_id: string | null;
}

export interface BingoTeam {
  id: string;
  event_id: string;
  name: string;
  color: string | null;
  members: BingoTeamMember[];
}

export interface BingoTile {
  id: string;
  event_id: string;
  position: number;
  task_title: string;
  task_description: string | null;
  tracking_type: BingoTileTrackingType;
  wom_competition_id: string | null;
  wom_target_value: number | null;
}

export interface BingoTileCompletion {
  id: string;
  tile_id: string;
  team_id: string;
  status: BingoTileCompletionStatus;
  wom_progress_value: number | null;
  image_urls: string[] | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  updated_at: string;
}

export function statusLabel(status: BingoTileCompletionStatus): string {
  if (status === "completed") return "Completed";
  if (status === "pending_review") return "Pending Review";
  return "Incomplete";
}
