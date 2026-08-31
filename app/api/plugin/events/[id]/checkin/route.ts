import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPluginToken } from "@/lib/plugin-auth";
import { checkInToEvent } from "@/lib/event-checkin";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/plugin/events/[id]/checkin -- self check-in from the RuneLite
 * plugin, sharing the exact same code-word gate as the website's check-in
 * page (lib/event-checkin.ts) so the code can't be bypassed by switching
 * paths. Requires a verified RSN, same reasoning as /api/plugin/events --
 * attendance credit is a real action, not read-only.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const identity = await verifyPluginToken(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!identity.rsnVerified || !identity.rsn) {
    return NextResponse.json({ error: "A verified RSN link is required to check in." }, { status: 403 });
  }

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : undefined;

  const result = await checkInToEvent(
    supabase,
    id,
    { discordId: identity.discordId, discordUsername: identity.discordUsername, rsn: identity.rsn },
    "plugin_checkin",
    code
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ checkedIn: true, name: result.name });
}
