import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPluginToken } from "@/lib/plugin-auth";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const ACCOUNT_TYPES = ["normal", "ironman", "hardcore_ironman", "ultimate_ironman", "group_ironman"];

/**
 * POST /api/plugin/sync -- periodic player-metadata sync. Unlike
 * /api/plugin/events this doesn't award points, so no rsnVerified gate --
 * it's harmless summary state, not something worth restricting.
 */
export async function POST(request: NextRequest) {
  const identity = await verifyPluginToken(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const accountType = ACCOUNT_TYPES.includes(body.accountType) ? body.accountType : null;
  const combatLevel = typeof body.combatLevel === "number" && body.combatLevel >= 3 && body.combatLevel <= 126 ? body.combatLevel : null;
  const totalLevel = typeof body.totalLevel === "number" && body.totalLevel >= 32 && body.totalLevel <= 2277 ? body.totalLevel : null;
  const totalXp = typeof body.totalXp === "number" && body.totalXp >= 0 ? body.totalXp : null;

  const { error } = await supabase
    .from("player_game_data")
    .upsert(
      {
        user_id: identity.userId,
        account_type: accountType,
        combat_level: combatLevel,
        total_level: totalLevel,
        total_xp: totalXp,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: "Failed to sync." }, { status: 500 });

  return NextResponse.json({ synced: true, syncedAt: new Date().toISOString() });
}
