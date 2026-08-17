import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { postToDestination } from "@/lib/discord";
import { getAlertChannel } from "@/lib/alert-channels";
import { normalizeRsn } from "@/lib/wom";
import { highlightTypeLabel } from "@/lib/gnomie-reviews";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// PATCH - approve or reject a review. Approving posts it to the configured
// Discord highlight channel; rejecting just closes it out with no post.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed, user } = await checkPermission("manage_gnomie_reviews");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const status = body.status;
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status must be 'approved' or 'rejected'." }, { status: 400 });
  }

  const { data: review } = await supabase.from("gnomie_reviews").select("*").eq("id", id).maybeSingle();
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });

  const reviewNotes = typeof body.review_notes === "string" ? body.review_notes.trim().slice(0, 1000) : null;

  const update: Record<string, unknown> = {
    status,
    review_notes: reviewNotes,
    reviewed_by: user?.discord_username ?? null,
    reviewed_at: new Date().toISOString(),
  };

  if (status === "approved") {
    const channelId = await getAlertChannel(supabase, "gnomie_reviews");
    if (!channelId) {
      return NextResponse.json({ error: "No Gn0mie Reviews highlight channel is configured. Set one under Admin > Alert Channels." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("discord_id, rsn")
      .not("rsn", "is", null);
    const match = (profile ?? []).find(
      (p: { discord_id: string; rsn: string | null }) => p.rsn && normalizeRsn(p.rsn) === normalizeRsn(review.target_rsn)
    );
    const targetMention = match ? `<@${match.discord_id}>` : `**${review.target_rsn}**`;

    const type = highlightTypeLabel(review.highlight_type);
    const from = review.submitter_name || "An anonymous Gn0mie";
    const content = `${type.emoji} **${type.label}** for ${targetMention}!\n\n${review.message}\n\n— ${from}`;

    let posted;
    try {
      const images: string[] = review.image_urls ?? [];
      posted = await postToDestination(channelId, `${type.label} for ${review.target_rsn}`, content, images.length > 0 ? images : undefined);
    } catch (err) {
      console.error("Gnomie review Discord post failed:", err);
      return NextResponse.json({ error: "Failed to post to Discord. The review was not approved." }, { status: 502 });
    }

    update.discord_message_id = posted.messageId;
    update.discord_channel_id = posted.channelId;
  }

  const { error } = await supabase.from("gnomie_reviews").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update review." }, { status: 500 });

  return NextResponse.json({ updated: true });
}

// DELETE - remove a review entirely (cleanup, e.g. spam that slipped through).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_gnomie_reviews");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await supabase.from("gnomie_reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete review." }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
