import type { SupabaseClient } from "@supabase/supabase-js";

export interface AlertChannelFeature {
  key: string;
  label: string;
  envVar?: string;
}

export const ALERT_CHANNEL_FEATURES: AlertChannelFeature[] = [
  { key: "events", label: "Event Posts", envVar: "DISCORD_EVENTS_CHANNEL_ID" },
  { key: "signups", label: "Sign-up Threads", envVar: "DISCORD_SIGNUPS_CHANNEL_ID" },
  { key: "announcements", label: "Announcements", envVar: "DISCORD_ANNOUNCEMENTS_CHANNEL_ID" },
  { key: "staff_applications", label: "Staff Applications", envVar: "DISCORD_STAFF_CHANNEL_ID" },
  { key: "polls", label: "Polls", envVar: "DISCORD_POLLS_CHANNEL_ID" },
  { key: "surveys", label: "Survey Responses" },
  { key: "feedback", label: "Feedback Submissions" },
  { key: "competitions", label: "WOM Competitions" },
  { key: "loans", label: "Loan Requests" },
  { key: "gnomie_reviews", label: "Gn0mie Reviews (Approved Highlights)", envVar: "DISCORD_GNOMIE_REVIEWS_CHANNEL_ID" },
  { key: "gnomie_reviews_staff", label: "Gn0mie Reviews (Staff Heads-Up)", envVar: "DISCORD_GNOMIE_REVIEWS_STAFF_CHANNEL_ID" },
  { key: "bingo_completions", label: "Bingo Tile Completions" },
];

/**
 * Resolve the destination channel for a feature: an admin-configured
 * override in the alert_channels table if set, else the feature's env var
 * default (if it has one), else null.
 */
export async function getAlertChannel(supabase: SupabaseClient, featureKey: string): Promise<string | null> {
  const { data } = await supabase
    .from("alert_channels")
    .select("channel_id")
    .eq("feature_key", featureKey)
    .maybeSingle();

  if (data?.channel_id) return data.channel_id;

  const feature = ALERT_CHANNEL_FEATURES.find((f) => f.key === featureKey);
  return (feature?.envVar ? process.env[feature.envVar] : undefined) ?? null;
}
