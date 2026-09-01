import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPluginToken } from "@/lib/plugin-auth";
import { hasPermission } from "@/lib/permissions";
import { translateEvent } from "@/lib/ingame-event-translation";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Admin-only backlog of upcoming events, pre-translated into the exact
 * values OSRS's in-game "Clan Home: Events" form expects -- backs the
 * plugin's guided in-game creation walkthrough. Reuses the same
 * translateEvent() the website's own /admin/ingame-events page uses, so the
 * plugin never computes a different answer than the site would show.
 */
export async function GET(request: NextRequest) {
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

  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, event_type, start_time, end_time, world, osrs_type, osrs_subtype, osrs_activity, osrs_join_rank, osrs_duration_days, osrs_added_ingame")
    .eq("show_on_calendar", true)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: "Failed to load events." }, { status: 500 });

  const translated = (events ?? []).map((ev) => ({
    id: ev.id,
    title: ev.title,
    world: ev.world,
    addedIngame: ev.osrs_added_ingame,
    ...translateEvent(ev),
  }));

  return NextResponse.json({ events: translated });
}
