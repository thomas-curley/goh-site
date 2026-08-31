import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { notifyPayoutWinner } from "@/lib/payouts";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST - (re)send the Discord DM notification for one payout. Same logic
// whether this is the first attempt or a retry after a failure.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: payout } = await supabase
    .from("prize_payouts")
    .select("id, recipient_rsn, prize, placement, source_detail, wom_competitions(title), events(title), raffles(title)")
    .eq("id", id)
    .maybeSingle();

  if (!payout) return NextResponse.json({ error: "Payout not found." }, { status: 404 });
  if (!payout.prize.trim()) return NextResponse.json({ error: "Set a prize amount before sending a notification." }, { status: 400 });

  const competitionLabel =
    payout.wom_competitions?.title ?? payout.events?.title ?? payout.raffles?.title ?? payout.source_detail ?? "Gn0me Home";

  await supabase.from("prize_payouts").update({ dm_requested: true, updated_at: new Date().toISOString() }).eq("id", id);

  await notifyPayoutWinner(supabase, {
    id: payout.id,
    recipient_rsn: payout.recipient_rsn,
    prize: payout.prize,
    placement: payout.placement,
    competitionLabel,
  });

  const { data: updated } = await supabase.from("prize_payouts").select("dm_status, dm_error, dm_sent_at").eq("id", id).maybeSingle();

  return NextResponse.json({ notified: true, ...updated });
}
