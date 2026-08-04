import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { postToDestination } from "@/lib/discord";
import { getAlertChannel } from "@/lib/alert-channels";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkSurveyEligibility } from "@/lib/surveys";
import type { SurveyQuestion } from "@/lib/surveys";
import { getRequestIp, isIpBanned } from "@/lib/ip-ban";
import { checkSubmissionRateLimit, isHoneypotTripped, submittedTooFast } from "@/lib/spam-guard";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_NAME_LENGTH = 80;
const MAX_TEXT_ANSWER_LENGTH = 2000;

// POST - submit a response. Fully public and anonymous by default --
// respondent_name is only set if the submitter chose to fill it in.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: survey } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle();
  if (!survey) return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  if (!survey.is_active) return NextResponse.json({ error: "This survey is closed." }, { status: 400 });

  const requestIp = getRequestIp(request);
  if (await isIpBanned(supabase, requestIp)) {
    return NextResponse.json(
      { error: "You've been blocked from submitting to this survey. Contact a staff member if you think this is a mistake." },
      { status: 403 }
    );
  }
  if (!checkSubmissionRateLimit(requestIp).allowed) {
    return NextResponse.json({ error: "Too many submissions from this connection. Try again in a few minutes." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));

  // Silently "succeed" for an obvious bot (filled the hidden honeypot
  // field) rather than telling it what tripped -- a real rejection just
  // teaches a scripted bot to stop sending that field.
  if (isHoneypotTripped(body)) {
    return NextResponse.json({ submitted: true });
  }
  if (submittedTooFast(body.renderedAt)) {
    return NextResponse.json({ error: "That was fast! Please wait a moment and try again." }, { status: 429 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  const eligibility = await checkSurveyEligibility(supabase, survey.access_level, authUser?.id ?? null);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason ?? "You are not eligible to take this survey." }, { status: 403 });
  }

  const questions: SurveyQuestion[] = survey.questions ?? [];
  const rawAnswers = body.answers && typeof body.answers === "object" ? body.answers : {};

  const answers = questions.map((q) => {
    const raw = rawAnswers[q.id];
    let value: string | number | string[] | null = null;
    if (q.type === "rating") {
      const n = Number(raw);
      value = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : null;
    } else if (q.type === "likert") {
      const n = Number(raw);
      const scale = q.scale === 3 ? 3 : 5;
      value = Number.isFinite(n) ? Math.min(scale, Math.max(1, Math.round(n))) : null;
    } else if (q.type === "multiple_choice" && q.allowMultiple) {
      const selected = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string" && !!q.options?.includes(v)) : [];
      value = selected.length > 0 ? selected : null;
    } else if (q.type === "multiple_choice") {
      value = typeof raw === "string" && q.options?.includes(raw) ? raw : null;
    } else {
      value = typeof raw === "string" ? raw.trim().slice(0, MAX_TEXT_ANSWER_LENGTH) : null;
    }
    return { question_id: q.id, value };
  });

  const missingRequired = questions.some((q, i) => {
    const value = answers[i].value;
    return q.required && (value === null || (Array.isArray(value) && value.length === 0));
  });
  if (missingRequired) {
    return NextResponse.json({ error: "Please answer all required questions." }, { status: 400 });
  }

  const gated = survey.access_level !== "anonymous";
  const respondentName = gated
    ? eligibility.verifiedName ?? null
    : (typeof body.respondentName === "string" ? body.respondentName.trim().slice(0, MAX_NAME_LENGTH) : "") || null;
  const discordId = gated ? eligibility.discordId ?? null : null;

  const { error } = await supabase.from("survey_responses").insert({
    survey_id: id,
    answers,
    respondent_name: respondentName,
    discord_id: discordId,
    ip_address: requestIp,
  });

  if (error) return NextResponse.json({ error: "Failed to submit response." }, { status: 500 });

  try {
    const channelId = await getAlertChannel(supabase, "surveys");
    if (channelId) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gn0mehome.com";
      await postToDestination(
        channelId,
        survey.title,
        `📊 **New response** to "${survey.title}" from ${respondentName || "Anonymous"}\nView results: ${siteUrl}/admin/surveys`
      );
    }
  } catch (err) {
    console.error("Survey response notification failed:", err);
  }

  return NextResponse.json({ submitted: true });
}

// GET - list responses for the admin results view.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_surveys");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("survey_id", id)
    .order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load responses." }, { status: 500 });

  return NextResponse.json({ responses: data ?? [] });
}
