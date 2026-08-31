import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_PLACEMENTS = 20;

// GET - the default prize structure used to auto-fill winners pulled in
// from a picked competition's standings.
export async function GET() {
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("payout_prize_defaults").select("placements, default_amount").eq("id", 1).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Failed to load prize defaults." }, { status: 500 });

  return NextResponse.json({ placements: data.placements, defaultAmount: Number(data.default_amount) });
}

// PUT - update the default prize structure.
export async function PUT(request: NextRequest) {
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));

  const rawPlacements = Array.isArray(body.placements) ? body.placements : [];
  const placements = rawPlacements
    .map((p: unknown) => {
      if (typeof p !== "object" || p === null) return null;
      const record = p as Record<string, unknown>;
      const placement = Number(record.placement);
      const amount = Number(record.amount);
      if (!Number.isInteger(placement) || placement < 1 || !Number.isFinite(amount) || amount < 0) return null;
      return { placement, amount };
    })
    .filter((p: { placement: number; amount: number } | null): p is { placement: number; amount: number } => p !== null)
    .slice(0, MAX_PLACEMENTS)
    .sort((a: { placement: number }, b: { placement: number }) => a.placement - b.placement);

  const defaultAmount = Number(body.defaultAmount);
  if (!Number.isFinite(defaultAmount) || defaultAmount < 0) {
    return NextResponse.json({ error: "Default amount must be a non-negative number." }, { status: 400 });
  }

  const { error } = await supabase
    .from("payout_prize_defaults")
    .update({ placements, default_amount: defaultAmount, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: "Failed to save prize defaults." }, { status: 500 });

  return NextResponse.json({ saved: true });
}
