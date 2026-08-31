import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPluginToken } from "@/lib/plugin-auth";
import { recordPluginEvent, PLUGIN_EVENT_TYPES, type PluginEventType } from "@/lib/clan-points";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/plugin/events -- real-time ingest for one plugin-detected event
 * (level-up, quest completion, boss KC milestone, clue scroll, pet drop).
 * Unlike the read-only reminders digest, this awards clan points, so it
 * additionally requires a verified RSN link -- an unverified linked account
 * earning points is an actual abuse vector, not just a cosmetic gap.
 */
export async function POST(request: NextRequest) {
  const identity = await verifyPluginToken(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!identity.rsnVerified || !identity.rsn) {
    return NextResponse.json({ error: "A verified RSN link is required to report events." }, { status: 403 });
  }

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const eventType = body.eventType as PluginEventType;
  if (!PLUGIN_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json({ error: "Unknown eventType." }, { status: 400 });
  }

  const detail = typeof body.detail === "object" && body.detail !== null ? body.detail : {};
  const clientEventId = typeof body.clientEventId === "string" ? body.clientEventId : undefined;

  if ((eventType === "clue_scroll" || eventType === "pet_drop") && !clientEventId) {
    return NextResponse.json({ error: "clientEventId is required for this event type." }, { status: 400 });
  }

  const result = await recordPluginEvent(supabase, identity.userId, identity.rsn, eventType, detail, clientEventId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    accepted: true,
    duplicate: result.duplicate,
    pointsAwarded: result.pointsAwarded,
    newBalance: result.newBalance,
  });
}
