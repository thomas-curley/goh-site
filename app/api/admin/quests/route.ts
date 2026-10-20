import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { QUEST_EVENT_COLUMNS, questServiceClient } from "@/lib/quest-server";

// GET - every quest event for the admin list, newest first, with counts.
export async function GET() {
  const { allowed } = await checkPermission("manage_quests");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: events, error } = await supabase.from("quest_events").select(QUEST_EVENT_COLUMNS).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load quest events." }, { status: 500 });
  const ids = (events ?? []).map((e) => e.id);
  const [{ data: players }, { data: pending }] = ids.length
    ? await Promise.all([
        supabase.from("quest_event_participants").select("event_id").in("event_id", ids),
        supabase.from("quest_event_submissions").select("event_id").in("event_id", ids).eq("status", "pending"),
      ])
    : [{ data: [] }, { data: [] }];
  const count = (rows: { event_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.event_id === id).length;

  return NextResponse.json({
    events: (events ?? []).map((e) => ({ ...e, playerCount: count(players, e.id), pendingCount: count(pending, e.id) })),
  });
}

// POST - start a new draft event, blank or copied from an earlier one
// (settings, quest list and team names, but no players or progress).
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_quests");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return NextResponse.json({ error: "Give the event a name." }, { status: 400 });
  const copyFrom = typeof body.copyFrom === "string" && body.copyFrom ? body.copyFrom : null;

  let base: Record<string, unknown> = {};
  if (copyFrom) {
    const { data: source } = await supabase
      .from("quest_events")
      .select("description, rules, banner_url, format, scoring, difficulty_points, flat_points, quest_names, include_miniquests, auto_add_members")
      .eq("id", copyFrom)
      .maybeSingle();
    if (!source) return NextResponse.json({ error: "The event to copy wasn't found." }, { status: 404 });
    base = source;
  }

  const { data: event, error } = await supabase
    .from("quest_events")
    .insert({ ...base, name, status: "draft", created_by: user?.discord_username ?? null })
    .select("id")
    .single();
  if (error || !event) return NextResponse.json({ error: "Couldn't create the event." }, { status: 500 });

  if (copyFrom) {
    const { data: teams } = await supabase.from("quest_event_teams").select("name, color, sort_order").eq("event_id", copyFrom);
    if (teams?.length) await supabase.from("quest_event_teams").insert(teams.map((t) => ({ ...t, event_id: event.id })));
  }
  return NextResponse.json({ id: event.id });
}
