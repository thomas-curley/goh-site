import { NextRequest, NextResponse, after } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { announceQuestResults, loadQuestBundle, questLaunchProblems, questServiceClient, questsRemaining, syncQuestEvent } from "@/lib/quest-server";
import { computeStandings, DIFFICULTIES, QUEST_BY_NAME, type QuestEventStatus } from "@/lib/quests";

const STATUSES: QuestEventStatus[] = ["draft", "signups", "active", "completed"];

async function guard() {
  const { allowed, user } = await checkPermission("manage_quests");
  if (!allowed) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const supabase = questServiceClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  return { supabase, user };
}

// GET - the whole event for the builder: settings, teams, players (with how
// many of the event's quests each still had to do), completions, standings
// and what's left before it can go live.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  const { supabase } = ctx;

  const bundle = await loadQuestBundle(supabase, id);
  if (!bundle) return NextResponse.json({ error: "Quest event not found." }, { status: 404 });
  const [remaining, { count: pendingCount }] = await Promise.all([
    questsRemaining(supabase, bundle.event, bundle.participants.map((p) => p.id)),
    supabase.from("quest_event_submissions").select("*", { count: "exact", head: true }).eq("event_id", id).eq("status", "pending"),
  ]);

  return NextResponse.json({
    ...bundle,
    participants: bundle.participants.map((p) => ({ ...p, remaining: remaining.get(p.id) ?? null })),
    standings: computeStandings(bundle.event, bundle.participants, bundle.teams, bundle.completions),
    pendingCount: pendingCount ?? 0,
    launchProblems: questLaunchProblems(bundle),
  });
}

// PATCH - change the event's settings, quest list or status. Going live
// checks it's ready first; finishing posts the results.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  const { supabase } = ctx;

  const bundle = await loadQuestBundle(supabase, id);
  if (!bundle) return NextResponse.json({ error: "Quest event not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  const text = (key: string, max: number) => {
    if (key in body) update[key] = typeof body[key] === "string" ? body[key].trim().slice(0, max) || null : null;
  };
  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
    if (!name) return NextResponse.json({ error: "The event needs a name." }, { status: 400 });
    update.name = name;
  }
  text("description", 2000);
  text("rules", 4000);
  text("banner_url", 1000);
  for (const key of ["starts_at", "ends_at"]) {
    if (key in body) {
      const v = body[key];
      if (v !== null && (typeof v !== "string" || Number.isNaN(Date.parse(v)))) return NextResponse.json({ error: "That date isn't valid." }, { status: 400 });
      update[key] = v;
    }
  }
  if ("format" in body && body.format !== bundle.event.format) {
    if (bundle.event.status === "active" || bundle.event.status === "completed") {
      return NextResponse.json({ error: "Solo or teams can't change once the event is live." }, { status: 400 });
    }
    update.format = body.format === "teams" ? "teams" : "solo";
  }
  if ("scoring" in body) update.scoring = ["difficulty", "qp", "flat"].includes(body.scoring) ? body.scoring : "difficulty";
  if ("difficulty_points" in body && body.difficulty_points && typeof body.difficulty_points === "object") {
    update.difficulty_points = Object.fromEntries(DIFFICULTIES.map((d) => [d, Math.max(0, Math.min(1000, Math.floor(Number(body.difficulty_points[d]) || 0)))]));
  }
  if ("flat_points" in body) update.flat_points = Math.max(0, Math.min(1000, Math.floor(Number(body.flat_points) || 0)));
  if ("include_miniquests" in body) update.include_miniquests = !!body.include_miniquests;
  if ("quest_names" in body) {
    if (!Array.isArray(body.quest_names)) return NextResponse.json({ error: "The quest list isn't valid." }, { status: 400 });
    update.quest_names = [...new Set((body.quest_names as unknown[]).filter((n): n is string => typeof n === "string" && QUEST_BY_NAME.has(n)))];
  }

  if ("status" in body) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    if (body.status === "active" && bundle.event.status !== "active") {
      const problems = questLaunchProblems({ ...bundle, event: { ...bundle.event, ...update } });
      if (problems.length) return NextResponse.json({ error: "This event isn't ready to go live yet.", problems }, { status: 400 });
    }
    update.status = body.status;
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ saved: true });
  update.updated_at = new Date().toISOString();
  const { error } = await supabase.from("quest_events").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't save the event." }, { status: 500 });
  if (update.status === "completed" && bundle.event.status === "active") {
    await announceQuestResults(supabase, { ...bundle, event: { ...bundle.event, ...update } as typeof bundle.event });
  }
  // Opening sign-ups or going live takes everyone's starting snapshot.
  if ((update.status === "signups" || update.status === "active") && update.status !== bundle.event.status) {
    after(() => syncQuestEvent(supabase, id).then(() => undefined).catch(() => undefined));
  }
  return NextResponse.json({ saved: true });
}

// DELETE - remove an event and everything in it.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  const { error } = await ctx.supabase.from("quest_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't delete the event." }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
