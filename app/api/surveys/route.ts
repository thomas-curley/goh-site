import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import type { QuestionType, AccessLevel } from "@/lib/surveys";

const VALID_ACCESS_LEVELS: AccessLevel[] = ["anonymous", "verified_player", "clan_member"];

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const VALID_TYPES: QuestionType[] = ["rating", "multiple_choice", "text", "likert"];
const MAX_QUESTIONS = 20;

// GET - list surveys. Public callers get only active ones (?active=true);
// admins can list everything for the builder page.
export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const activeOnly = request.nextUrl.searchParams.get("active") === "true";

  let query = supabase.from("surveys").select("*").order("created_at", { ascending: false });
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load surveys." }, { status: 500 });

  return NextResponse.json({ surveys: data ?? [] });
}

// POST - create a survey.
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_surveys");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const rawQuestions: unknown[] = Array.isArray(body.questions) ? body.questions : [];
  const accessLevel: AccessLevel = VALID_ACCESS_LEVELS.includes(body.accessLevel) ? body.accessLevel : "anonymous";

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (rawQuestions.length === 0 || rawQuestions.length > MAX_QUESTIONS) {
    return NextResponse.json({ error: `Provide between 1 and ${MAX_QUESTIONS} questions.` }, { status: 400 });
  }

  const questions = rawQuestions
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
        scale: type === "likert" ? (q.scale === 3 ? 3 : 5) : undefined,
        required: q.required === true,
      };
    });

  if (questions.some((q) => !q.prompt)) {
    return NextResponse.json({ error: "Every question needs a prompt." }, { status: 400 });
  }
  if (questions.some((q) => q.type === "multiple_choice" && (q.options?.length ?? 0) < 2)) {
    return NextResponse.json({ error: "Multiple-choice questions need at least 2 options." }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("surveys")
    .insert({
      title,
      description: description || null,
      questions,
      access_level: accessLevel,
      created_by: user?.discord_username ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "Failed to create survey." }, { status: 500 });

  return NextResponse.json({ id: inserted.id });
}
