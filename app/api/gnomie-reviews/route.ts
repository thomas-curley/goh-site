import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { postToDestination } from "@/lib/discord";
import { getAlertChannel } from "@/lib/alert-channels";
import { getRequestIp, isIpBanned } from "@/lib/ip-ban";
import { checkSubmissionRateLimit, isHoneypotTripped, submittedTooFast } from "@/lib/spam-guard";
import { HIGHLIGHT_TYPE_KEYS, highlightTypeLabel } from "@/lib/gnomie-reviews";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_MESSAGE_LENGTH = 1000;
const MAX_NAME_LENGTH = 80;
const MAX_IMAGES = 3;

// POST - submit a shoutout about a clan member. Fully public and anonymous
// by default (like general Feedback) -- sits as 'pending' until an admin
// approves it, at which point it gets posted to Discord to highlight them.
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const requestIp = getRequestIp(request);
  if (await isIpBanned(supabase, requestIp)) {
    return NextResponse.json(
      { error: "You've been blocked from submitting reviews. Contact a staff member if you think this is a mistake." },
      { status: 403 }
    );
  }
  if (!checkSubmissionRateLimit(requestIp).allowed) {
    return NextResponse.json({ error: "Too many submissions from this connection. Try again in a few minutes." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));

  if (isHoneypotTripped(body)) {
    return NextResponse.json({ submitted: true });
  }
  if (submittedTooFast(body.renderedAt)) {
    return NextResponse.json({ error: "That was fast! Please wait a moment and try again." }, { status: 429 });
  }

  const targetRsn = typeof body.targetRsn === "string" ? body.targetRsn.trim().slice(0, 80) : "";
  const highlightType = HIGHLIGHT_TYPE_KEYS.includes(body.highlightType) ? body.highlightType : "shoutout";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  const submitterName = typeof body.submitterName === "string" ? body.submitterName.trim().slice(0, MAX_NAME_LENGTH) : "";
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u: unknown): u is string => typeof u === "string" && u.trim().length > 0).slice(0, MAX_IMAGES)
    : [];

  if (!targetRsn) {
    return NextResponse.json({ error: "Pick who you're highlighting." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const { error } = await supabase.from("gnomie_reviews").insert({
    target_rsn: targetRsn,
    highlight_type: highlightType,
    message,
    submitter_name: submitterName || null,
    image_urls: imageUrls,
    ip_address: requestIp,
  });

  if (error) return NextResponse.json({ error: "Failed to submit review." }, { status: 500 });

  try {
    const channelId = await getAlertChannel(supabase, "gnomie_reviews_staff");
    if (channelId) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gn0mehome.com";
      const preview = message.length > 300 ? `${message.slice(0, 300)}…` : message;
      await postToDestination(
        channelId,
        "New Gn0mie Review",
        `${highlightTypeLabel(highlightType).emoji} New review pending approval for **${targetRsn}**, from ${submitterName || "Anonymous"}\n> ${preview}\nReview in admin: ${siteUrl}/admin/gnomie-reviews`
      );
    }
  } catch (err) {
    console.error("Gnomie review staff notification failed:", err);
  }

  return NextResponse.json({ submitted: true });
}

// GET - list reviews for the admin moderation queue.
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_gnomie_reviews");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const status = request.nextUrl.searchParams.get("status");

  let query = supabase.from("gnomie_reviews").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load reviews." }, { status: 500 });

  return NextResponse.json({ reviews: data ?? [], guildId: process.env.DISCORD_GUILD_ID ?? null });
}
