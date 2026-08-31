import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_TEMPLATE_LENGTH = 1000;

// GET - the current DM notification template.
export async function GET() {
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("payout_dm_config").select("template").eq("id", 1).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Failed to load DM template." }, { status: 500 });

  return NextResponse.json({ template: data.template });
}

// PUT - update the DM notification template.
export async function PUT(request: NextRequest) {
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const template = typeof body.template === "string" ? body.template.trim().slice(0, MAX_TEMPLATE_LENGTH) : "";
  if (!template) return NextResponse.json({ error: "Template can't be empty." }, { status: 400 });

  const { error } = await supabase.from("payout_dm_config").update({ template, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return NextResponse.json({ error: "Failed to save template." }, { status: 500 });

  return NextResponse.json({ saved: true });
}
