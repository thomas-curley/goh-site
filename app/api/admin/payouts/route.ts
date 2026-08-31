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

const CATEGORIES = ["sotw", "botw", "event", "raffle", "giveaway", "other"];
const MAX_RSN_LENGTH = 80;
const MAX_PRIZE_LENGTH = 200;

// GET - every payout entry, optionally filtered by paid status.
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const paidParam = request.nextUrl.searchParams.get("paid");
  let query = supabase
    .from("prize_payouts")
    .select("*, wom_competitions(title), events(title), raffles(title)")
    .order("created_at", { ascending: false });
  if (paidParam === "true") query = query.eq("is_paid", true);
  if (paidParam === "false") query = query.eq("is_paid", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load payouts." }, { status: 500 });

  return NextResponse.json({ payouts: data ?? [] });
}

// POST - batch-create payout entries (e.g. all 10 SOTW winners at once).
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const rawEntries = Array.isArray(body.entries) ? body.entries : [];

  // Applied to every row in the batch, mirroring how category/source_detail
  // already apply batch-wide -- lets "Add Winners" tie a whole batch to the
  // competition/event/raffle it came from instead of freeform text.
  const womCompetitionId = typeof body.womCompetitionId === "string" && body.womCompetitionId ? body.womCompetitionId : null;
  const eventId = typeof body.eventId === "string" && body.eventId ? body.eventId : null;
  const raffleId = typeof body.raffleId === "string" && body.raffleId ? body.raffleId : null;
  const notifyWinners = body.notifyWinners === true;

  const rows = rawEntries
    .map((e: Record<string, unknown>) => ({
      recipient_rsn: typeof e.recipient_rsn === "string" ? e.recipient_rsn.trim().slice(0, MAX_RSN_LENGTH) : "",
      prize: typeof e.prize === "string" ? e.prize.trim().slice(0, MAX_PRIZE_LENGTH) : "",
      category: CATEGORIES.includes(e.category as string) ? e.category : "other",
      source_detail: typeof e.source_detail === "string" ? e.source_detail.trim() || null : null,
      wom_competition_id: womCompetitionId,
      event_id: eventId,
      raffle_id: raffleId,
      created_by: user?.discord_username ?? null,
      dm_requested: notifyWinners,
    }))
    .filter((r: { recipient_rsn: string; prize: string }) => r.recipient_rsn && r.prize);

  if (rows.length === 0) {
    return NextResponse.json({ error: "At least one entry with an RSN and prize is required." }, { status: 400 });
  }

  const { data, error } = await supabase.from("prize_payouts").insert(rows).select();
  if (error) return NextResponse.json({ error: "Failed to save payouts." }, { status: 500 });

  if (notifyWinners && data) {
    // A batch shares one competition/event/raffle link, so its display name
    // only needs fetching once -- source_detail (per-row) is the fallback
    // for any row that doesn't have one of those links.
    let sharedLabel: string | null = null;
    if (womCompetitionId) {
      const { data: c } = await supabase.from("wom_competitions").select("title").eq("id", womCompetitionId).maybeSingle();
      sharedLabel = c?.title ?? null;
    } else if (eventId) {
      const { data: e } = await supabase.from("events").select("title").eq("id", eventId).maybeSingle();
      sharedLabel = e?.title ?? null;
    } else if (raffleId) {
      const { data: r } = await supabase.from("raffles").select("title").eq("id", raffleId).maybeSingle();
      sharedLabel = r?.title ?? null;
    }

    // Sequential, not Promise.all -- Discord's DM-channel-creation endpoint
    // has tighter rate limits than regular channel posts, and one failure
    // must never stop the rest of the batch from being attempted.
    for (const row of data) {
      await notifyPayoutWinner(supabase, {
        id: row.id,
        recipient_rsn: row.recipient_rsn,
        prize: row.prize,
        placement: row.placement,
        competitionLabel: sharedLabel ?? row.source_detail ?? "Gn0me Home",
      });
    }
  }

  return NextResponse.json({ payouts: data }, { status: 201 });
}
