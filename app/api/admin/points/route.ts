import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_POINTS = 1000;

// GET - every points rule.
export async function GET() {
  const { allowed } = await checkPermission("manage_points");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("clan_points_rules").select("*").order("rule_key");
  if (error) return NextResponse.json({ error: "Failed to load points rules." }, { status: 500 });

  return NextResponse.json({ rules: data ?? [] });
}

// PUT - update one rule's points value or enabled flag (rule_key/label are fixed by code, not editable here).
export async function PUT(request: NextRequest) {
  const { allowed } = await checkPermission("manage_points");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const ruleKey = typeof body.ruleKey === "string" ? body.ruleKey : "";
  const points = Number.isInteger(body.points) ? Math.max(0, Math.min(MAX_POINTS, body.points)) : null;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : null;

  if (!ruleKey || points === null || enabled === null) {
    return NextResponse.json({ error: "ruleKey, points, and enabled are required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("clan_points_rules")
    .update({ points, enabled, updated_at: new Date().toISOString() })
    .eq("rule_key", ruleKey);

  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });

  return NextResponse.json({ saved: true });
}
