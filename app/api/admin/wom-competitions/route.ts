import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SKILLS, BOSSES, ACTIVITIES, COMPUTED_METRICS } from "@wise-old-man/utils";
import { checkPermission } from "@/lib/check-permission";
import { createWomCompetition } from "@/lib/wom";
import { postToDestination } from "@/lib/discord";
import { getAlertChannel } from "@/lib/alert-channels";
import { WOM_GROUP_ID } from "@/lib/constants";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const VALID_METRICS = new Set<string>([...SKILLS, ...BOSSES, ...ACTIVITIES, ...COMPUTED_METRICS]);
const MAX_TITLE_LENGTH = 100;

// GET - list competitions created from this site. Never returns
// verification_code -- that stays server-side, used only for deletes.
export async function GET() {
  const { allowed } = await checkPermission("manage_competitions");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("wom_competitions")
    .select("id, wom_id, title, metric, type, starts_at, ends_at, group_linked, participants, teams, created_by, created_at")
    .order("starts_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load competitions." }, { status: 500 });

  return NextResponse.json({
    competitions: data ?? [],
    clanAutoIncludeAvailable: !!process.env.WOM_GROUP_VERIFICATION_CODE,
  });
}

// POST - create a competition on WOM (entire clan, a hand-picked participant
// list, or teams), track it locally, and optionally post an announcement.
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_competitions");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));

  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
  const metric = typeof body.metric === "string" ? body.metric : "";
  const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
  const endsAt = typeof body.endsAt === "string" ? body.endsAt : "";
  const participantMode = body.participantMode;
  const postToDiscord = body.postToDiscord !== false;

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!VALID_METRICS.has(metric)) return NextResponse.json({ error: "Invalid metric." }, { status: 400 });
  if (!startsAt || !endsAt || Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt))) {
    return NextResponse.json({ error: "Valid start and end times are required." }, { status: 400 });
  }
  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: "End time must be after the start time." }, { status: 400 });
  }

  // Build the create payload for the chosen participant mode.
  let createPayload: Parameters<typeof createWomCompetition>[0];
  let type: "classic" | "team";
  let groupLinked = false;
  let participantsToStore: string[] | null = null;
  let teamsToStore: { name: string; participants: string[] }[] | null = null;

  if (participantMode === "clan") {
    const groupVerificationCode = process.env.WOM_GROUP_VERIFICATION_CODE;
    if (!groupVerificationCode) {
      return NextResponse.json(
        { error: "WOM_GROUP_VERIFICATION_CODE isn't configured yet -- add it to the environment to enable this option." },
        { status: 400 }
      );
    }
    createPayload = { title, metric, startsAt, endsAt, groupId: WOM_GROUP_ID, groupVerificationCode };
    type = "classic";
    groupLinked = true;
  } else if (participantMode === "participants") {
    const participants: string[] = Array.isArray(body.participants)
      ? body.participants.map((p: unknown) => (typeof p === "string" ? p.trim() : "")).filter(Boolean)
      : [];
    if (participants.length === 0) {
      return NextResponse.json({ error: "Add at least one participant." }, { status: 400 });
    }
    createPayload = { title, metric, startsAt, endsAt, participants };
    type = "classic";
    participantsToStore = participants;
  } else if (participantMode === "teams") {
    const rawTeams: unknown[] = Array.isArray(body.teams) ? body.teams : [];
    const teams = rawTeams
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => ({
        name: typeof t.name === "string" ? t.name.trim() : "",
        participants: Array.isArray(t.participants)
          ? t.participants.map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean)
          : [],
      }))
      .filter((t) => t.name && t.participants.length > 0);
    if (teams.length < 2) {
      return NextResponse.json({ error: "Add at least two teams, each with a name and at least one participant." }, { status: 400 });
    }
    createPayload = { title, metric, startsAt, endsAt, teams };
    type = "team";
    teamsToStore = teams;
  } else {
    return NextResponse.json({ error: "Invalid participant mode." }, { status: 400 });
  }

  let created;
  try {
    created = await createWomCompetition(createPayload);
  } catch (err) {
    console.error("WOM competition creation failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create the competition on WOM." }, { status: 502 });
  }

  const { error: insertError } = await supabase.from("wom_competitions").insert({
    wom_id: created.competition.id,
    title,
    metric,
    type,
    starts_at: startsAt,
    ends_at: endsAt,
    group_linked: groupLinked,
    verification_code: created.verificationCode,
    participants: participantsToStore,
    teams: teamsToStore,
    created_by: user?.discord_username ?? null,
  });

  if (insertError) {
    console.error("Failed to save WOM competition tracking row:", insertError);
    // The competition was created on WOM regardless -- surface that so the
    // admin doesn't try to create it again, even though we couldn't save
    // our own tracking row (they can still manage it directly on WOM).
    return NextResponse.json(
      {
        error: `Competition was created on WOM (https://wiseoldman.net/competitions/${created.competition.id}) but failed to save locally: ${insertError.message}. It won't be deletable from this admin page -- manage it directly on WOM.`,
      },
      { status: 500 }
    );
  }

  if (postToDiscord) {
    try {
      const channelId = await getAlertChannel(supabase, "competitions");
      if (channelId) {
        const metricLabel = metric.replace(/_/g, " ");
        const dateStr = new Date(startsAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        await postToDestination(
          channelId,
          title,
          `🏆 **New competition:** ${title}\nMetric: ${metricLabel}\nStarts: ${dateStr}\nhttps://wiseoldman.net/competitions/${created.competition.id}`
        );
      }
    } catch (err) {
      console.error("Competition announcement failed:", err);
    }
  }

  return NextResponse.json({ womId: created.competition.id });
}
