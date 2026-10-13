import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { refreshClanRankings } from "@/lib/clan-rankings";

export const maxDuration = 60;

// POST - refresh clan rankings now (normally done by the daily cron).
export async function POST() {
  const { allowed } = await checkPermission("manage_member_profiles");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const result = await refreshClanRankings(createClient(url, key));
  return NextResponse.json(result);
}
