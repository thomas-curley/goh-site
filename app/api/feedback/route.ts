import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { postToDestination } from "@/lib/discord";
import { getAlertChannel } from "@/lib/alert-channels";
import { getRequestIp, isIpBanned } from "@/lib/ip-ban";
import { checkSubmissionRateLimit, isHoneypotTripped, submittedTooFast } from "@/lib/spam-guard";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_MESSAGE_LENGTH = 2000;
const MAX_NAME_LENGTH = 80;
const CATEGORIES = ["suggestion", "bug", "praise", "other"];

// POST - submit feedback. Fully public and anonymous by default.
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const requestIp = getRequestIp(request);
  if (await isIpBanned(supabase, requestIp)) {
    return NextResponse.json(
      { error: "You've been blocked from submitting feedback. Contact a staff member if you think this is a mistake." },
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

  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  const category = CATEGORIES.includes(body.category) ? body.category : null;
  const respondentName = typeof body.respondentName === "string" ? body.respondentName.trim().slice(0, MAX_NAME_LENGTH) : "";

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const { error } = await supabase.from("feedback_submissions").insert({
    message,
    category,
    respondent_name: respondentName || null,
    ip_address: requestIp,
  });

  if (error) return NextResponse.json({ error: "Failed to submit feedback." }, { status: 500 });

  try {
    const channelId = await getAlertChannel(supabase, "feedback");
    if (channelId) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gn0mehome.com";
      const preview = message.length > 300 ? `${message.slice(0, 300)}…` : message;
      await postToDestination(
        channelId,
        "Feedback Submission",
        `📝 **New feedback**${category ? ` (${category})` : ""} from ${respondentName || "Anonymous"}\n> ${preview}\nView in admin: ${siteUrl}/admin/feedback`
      );
    }
  } catch (err) {
    console.error("Feedback notification failed:", err);
  }

  return NextResponse.json({ submitted: true });
}

// GET - list feedback for the admin inbox.
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_feedback");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const status = request.nextUrl.searchParams.get("status");

  let query = supabase.from("feedback_submissions").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load feedback." }, { status: 500 });

  return NextResponse.json({ submissions: data ?? [] });
}
