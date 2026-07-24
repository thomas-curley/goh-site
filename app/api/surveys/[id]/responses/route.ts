import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { postToDestination } from "@/lib/discord";
import { getAlertChannel } from "@/lib/alert-channels";
import type { SurveyQuestion } from "@/lib/surveys";

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

  const body = await request.json().catch(() => ({}));
  const questions: SurveyQuestion[] = survey.questions ?? [];
  const rawAnswers = body.answers && typeof body.answers === "object" ? body.answers : {};

  const answers = questions.map((q) => {
    const raw = rawAnswers[q.id];
    let value: string | number | null = null;
    if (q.type === "rating") {
      const n = Number(raw);
      value = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : null;
    } else if (q.type === "multiple_choice") {
      value = typeof raw === "string" && q.options?.includes(raw) ? raw : null;
    } else {
      value = typeof raw === "string" ? raw.trim().slice(0, MAX_TEXT_ANSWER_LENGTH) : null;
    }
    return { question_id: q.id, value };
  });

  const missingRequired = questions.some((q, i) => q.required && !answers[i].value);
  if (missingRequired) {
    return NextResponse.json({ error: "Please answer all required questions." }, { status: 400 });
  }

  const respondentName = typeof body.respondentName === "string" ? body.respondentName.trim().slice(0, MAX_NAME_LENGTH) : "";

  const { error } = await supabase.from("survey_responses").insert({
    survey_id: id,
    answers,
    respondent_name: respondentName || null,
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
