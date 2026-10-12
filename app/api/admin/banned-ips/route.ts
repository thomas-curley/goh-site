import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - list every banned IP.
export async function GET() {
  const { allowed } = await checkPermission("manage_banned_ips");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("banned_ips").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load banned IPs." }, { status: 500 });

  return NextResponse.json({ bans: data ?? [] });
}

// POST - ban an IP address.
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_banned_ips");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  let ipAddress = typeof body.ipAddress === "string" ? body.ipAddress.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  // The survey results and feedback inbox don't show IPs, so they ban by the
  // response/submission id and the address is looked up here.
  const source =
    typeof body.surveyResponseId === "string" ? { table: "survey_responses", id: body.surveyResponseId }
    : typeof body.feedbackId === "string" ? { table: "feedback_submissions", id: body.feedbackId }
    : null;
  if (!ipAddress && source) {
    const { data: row } = await supabase.from(source.table).select("ip_address").eq("id", source.id).maybeSingle();
    ipAddress = typeof row?.ip_address === "string" ? row.ip_address : "";
    if (!ipAddress) return NextResponse.json({ error: "No IP address was recorded for that submission." }, { status: 400 });
  }

  if (!ipAddress) return NextResponse.json({ error: "An IP address is required." }, { status: 400 });

  const { error } = await supabase.from("banned_ips").insert({
    ip_address: ipAddress,
    reason: reason || null,
    banned_by: user?.discord_username ?? null,
  });

  if (error) {
    // Postgres unique_violation -- this IP is already banned.
    if (error.code === "23505") return NextResponse.json({ error: "That IP is already banned." }, { status: 409 });
    // inet type rejects anything that isn't a valid IP/CIDR.
    if (error.code === "22P02") return NextResponse.json({ error: "Not a valid IP address." }, { status: 400 });
    return NextResponse.json({ error: "Failed to ban that IP." }, { status: 500 });
  }

  return NextResponse.json({ banned: true });
}
