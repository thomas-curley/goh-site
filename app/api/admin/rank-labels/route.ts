import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { RANKS } from "@/lib/constants";
import { getRankLabels } from "@/lib/rank-labels";

async function context() {
  const { allowed } = await checkPermission("manage_settings");
  if (!allowed) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  return { supabase: createClient(url, key) };
}

// GET - every rank's custom label and description (blank = standard).
export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  return NextResponse.json({ labels: await getRankLabels(ctx.supabase) });
}

// PUT { labels: { [rankKey]: { label, description } } } - save them all.
export async function PUT(request: NextRequest) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const body = await request.json().catch(() => ({}));
  const incoming = (body.labels && typeof body.labels === "object" ? body.labels : {}) as Record<string, { label?: unknown; description?: unknown }>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
  const rows = RANKS.map((r) => ({
    rank_key: r.key,
    label: text(incoming[r.key]?.label, 40),
    description: text(incoming[r.key]?.description, 300),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await ctx.supabase.from("rank_labels").upsert(rows, { onConflict: "rank_key" });
  if (error) return NextResponse.json({ error: "Couldn't save the labels." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
