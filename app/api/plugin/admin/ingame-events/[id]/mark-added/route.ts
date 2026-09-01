import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPluginToken } from "@/lib/plugin-auth";
import { hasPermission } from "@/lib/permissions";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/plugin/admin/ingame-events/[id]/mark-added -- flips
 * osrs_added_ingame once the plugin's guided walkthrough confirms (by
 * re-reading the in-game events list) that the event now actually exists
 * in-game. Deliberately narrow: only ever sets this one flag, never the
 * translation fields themselves -- staff still owns those from the site.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const identity = await verifyPluginToken(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: perms } = await supabase
    .from("role_permissions")
    .select("role, permission, granted")
    .eq("permission", "manage_events");

  if (!hasPermission(perms ?? [], identity.clanRank, "manage_events")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("events")
    .update({ osrs_added_ingame: true })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Failed to update." }, { status: 500 });

  return NextResponse.json({ marked: true });
}
