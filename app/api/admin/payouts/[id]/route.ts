import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const CATEGORIES = ["sotw", "botw", "event", "raffle", "giveaway", "other"];

// PATCH - toggle paid status and/or edit an entry's details.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed, user } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.is_paid === "boolean") {
    update.is_paid = body.is_paid;
    update.paid_at = body.is_paid ? new Date().toISOString() : null;
    update.paid_by = body.is_paid ? (user?.discord_username ?? null) : null;
  }
  if (body.recipient_rsn !== undefined) {
    const rsn = typeof body.recipient_rsn === "string" ? body.recipient_rsn.trim() : "";
    if (!rsn) return NextResponse.json({ error: "RSN cannot be empty." }, { status: 400 });
    update.recipient_rsn = rsn;
  }
  if (body.prize !== undefined) {
    const prize = typeof body.prize === "string" ? body.prize.trim() : "";
    if (!prize) return NextResponse.json({ error: "Prize cannot be empty." }, { status: 400 });
    update.prize = prize;
  }
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    update.category = body.category;
  }
  if (body.source_detail !== undefined) update.source_detail = typeof body.source_detail === "string" ? body.source_detail.trim() || null : null;
  if (body.notes !== undefined) update.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  if (Array.isArray(body.screenshot_urls)) {
    update.screenshot_urls = body.screenshot_urls.filter((u: unknown) => typeof u === "string" && u);
  }

  const { data, error } = await supabase
    .from("prize_payouts")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to update payout." }, { status: 500 });

  return NextResponse.json({ payout: data });
}

// DELETE - remove an entry (e.g. added by mistake).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await supabase.from("prize_payouts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete payout." }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
