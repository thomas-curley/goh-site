import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - the singleton weekly-competition config row.
export async function GET() {
  const { allowed } = await checkPermission("manage_competitions");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("weekly_competition_config").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Failed to load weekly competition config." }, { status: 500 });

  return NextResponse.json({ config: data });
}

// PUT - update next_* (the normal weekly flow) and/or current_* (manual
// recovery, e.g. fixing a bad rotation) -- only the fields present in the
// body are touched.
export async function PUT(request: NextRequest) {
  const { allowed } = await checkPermission("manage_competitions");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const ids = (value: unknown): number[] | undefined =>
    Array.isArray(value) ? value.map((v) => Number(v)).filter((n) => Number.isInteger(n)) : undefined;
  const type = (value: unknown): "sotw" | "botw" | null | undefined =>
    value === "sotw" || value === "botw" ? value : value === null ? null : undefined;
  const text = (value: unknown): string | null | undefined =>
    typeof value === "string" ? value.trim().slice(0, 150) || null : value === null ? null : undefined;

  const nextIds = ids(body.nextCompetitionIds);
  if (nextIds !== undefined) update.next_competition_ids = nextIds;
  const nextType = type(body.nextCompetitionType);
  if (nextType !== undefined) update.next_competition_type = nextType;
  const nextName = text(body.nextCompetitionName);
  if (nextName !== undefined) update.next_competition_name = nextName;

  const currentIds = ids(body.currentCompetitionIds);
  if (currentIds !== undefined) update.current_competition_ids = currentIds;
  const currentType = type(body.currentCompetitionType);
  if (currentType !== undefined) update.current_competition_type = currentType;
  const currentName = text(body.currentCompetitionName);
  if (currentName !== undefined) update.current_competition_name = currentName;
  if (typeof body.currentWeekStartDate === "string" || body.currentWeekStartDate === null) {
    update.current_week_start_date = body.currentWeekStartDate || null;
  }
  if (typeof body.currentForumThreadId === "string" || body.currentForumThreadId === null) {
    const threadId = typeof body.currentForumThreadId === "string" ? body.currentForumThreadId.trim() : "";
    if (threadId && !/^\d{15,25}$/.test(threadId)) return NextResponse.json({ error: "Forum thread id must be a Discord id." }, { status: 400 });
    update.current_forum_thread_id = threadId || null;
  }
  const currentEmoji = text(body.currentCompetitionEmoji);
  if (currentEmoji !== undefined) update.current_competition_emoji = currentEmoji?.slice(0, 32) ?? null;

  const { error } = await supabase.from("weekly_competition_config").update(update).eq("id", 1);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });

  return NextResponse.json({ saved: true });
}
