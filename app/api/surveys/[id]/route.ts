import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkSurveyEligibility, type AccessLevel, type QuestionType, type SurveyQuestion } from "@/lib/surveys";

const VALID_ACCESS_LEVELS: AccessLevel[] = ["anonymous", "verified_player", "clan_member"];
const VALID_TYPES: QuestionType[] = ["rating", "multiple_choice", "text"];
const MAX_QUESTIONS = 20;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - a single survey, public (for the take-survey page). Includes an
// eligibility preview for the caller's current session, so a gated survey
// can show a "log in" / "link your RSN" / "not in the clan" screen before
// anyone fills anything out -- the response route re-checks this for real,
// this is just a heads-up.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: survey } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle();
  if (!survey) return NextResponse.json({ error: "Survey not found." }, { status: 404 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const eligibility = await checkSurveyEligibility(supabase, survey.access_level, user?.id ?? null);

  return NextResponse.json({ survey, eligibility });
}

// PATCH - toggle active/closed, or edit title/description/questions/access level.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_surveys");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.isActive === "boolean") update.is_active = body.isActive;
  if (typeof body.accessLevel === "string" && VALID_ACCESS_LEVELS.includes(body.accessLevel as AccessLevel)) {
    update.access_level = body.accessLevel;
  }
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    update.title = title;
  }
  if (typeof body.description === "string") {
    update.description = body.description.trim() || null;
  }
  if (Array.isArray(body.questions)) {
    const rawQuestions: unknown[] = body.questions;
    if (rawQuestions.length === 0 || rawQuestions.length > MAX_QUESTIONS) {
      return NextResponse.json({ error: `Provide between 1 and ${MAX_QUESTIONS} questions.` }, { status: 400 });
    }
    const questions: SurveyQuestion[] = rawQuestions
      .filter((q): q is Record<string, unknown> => typeof q === "object" && q !== null)
      .map((q, i) => {
        const type = VALID_TYPES.includes(q.type as QuestionType) ? (q.type as QuestionType) : "text";
        const prompt = typeof q.prompt === "string" ? q.prompt.trim() : "";
        const options = Array.isArray(q.options)
          ? q.options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean)
          : [];
        return {
          id: typeof q.id === "string" && q.id ? q.id : `q-${i}`,
          type,
          prompt,
          options: type === "multiple_choice" ? options : undefined,
          allowMultiple: type === "multiple_choice" ? q.allowMultiple === true : undefined,
          required: q.required === true,
        };
      });

    if (questions.some((q) => !q.prompt)) {
      return NextResponse.json({ error: "Every question needs a prompt." }, { status: 400 });
    }
    if (questions.some((q) => q.type === "multiple_choice" && (q.options?.length ?? 0) < 2)) {
      return NextResponse.json({ error: "Multiple-choice questions need at least 2 options." }, { status: 400 });
    }
    update.questions = questions;
  }

  const { error } = await supabase.from("surveys").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update survey." }, { status: 500 });

  return NextResponse.json({ updated: true });
}
