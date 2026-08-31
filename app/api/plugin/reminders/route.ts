import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPluginToken } from "@/lib/plugin-auth";
import { hasPermission } from "@/lib/permissions";
import { getPointsBalance } from "@/lib/clan-points";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function normalizeRsn(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

interface PayoutRow {
  id: string;
  recipient_rsn: string;
  prize: string;
  source_detail: string | null;
  wom_competitions: { title: string } | { title: string }[] | null;
  events: { title: string } | { title: string }[] | null;
  raffles: { title: string } | { title: string }[] | null;
}

function payoutLabel(row: PayoutRow): string {
  const pick = (rel: PayoutRow["wom_competitions"]) => (Array.isArray(rel) ? rel[0]?.title : rel?.title);
  return pick(row.wom_competitions) ?? pick(row.events) ?? pick(row.raffles) ?? row.source_detail ?? "Gn0me Home";
}

/**
 * GET /api/plugin/reminders -- single combined digest endpoint for the
 * RuneLite companion plugin (bearer-token auth via verifyPluginToken, never
 * cookie session -- this is a game-client caller, not a browser).
 */
export async function GET(request: NextRequest) {
  const identity = await verifyPluginToken(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: upcomingEvents } = await supabase
    .from("events")
    .select("id, title, start_time, world, meet_location, location")
    .eq("show_on_calendar", true)
    .gte("start_time", now.toISOString())
    .lte("start_time", weekOut.toISOString())
    .order("start_time", { ascending: true });

  const eventIds = (upcomingEvents ?? []).map((e) => e.id);
  const signedUpEventIds = new Set<string>();
  if (eventIds.length > 0) {
    const { data: attendance } = await supabase
      .from("event_attendance")
      .select("event_id")
      .eq("discord_id", identity.discordId)
      .eq("signed_up", true)
      .in("event_id", eventIds);
    for (const row of attendance ?? []) signedUpEventIds.add(row.event_id);
  }

  const events = (upcomingEvents ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    startTime: e.start_time,
    world: e.world,
    meetLocation: e.meet_location ?? e.location ?? null,
    signedUp: signedUpEventIds.has(e.id),
  }));

  let myPendingPrizes: { prize: string; competition: string }[] = [];
  if (identity.rsnVerified && identity.rsn) {
    const { data: payouts } = await supabase
      .from("prize_payouts")
      .select("id, recipient_rsn, prize, source_detail, wom_competitions(title), events(title), raffles(title)")
      .eq("is_paid", false);

    const normalized = normalizeRsn(identity.rsn);
    const typedPayouts = (payouts ?? []) as unknown as PayoutRow[];
    myPendingPrizes = typedPayouts
      .filter((p) => normalizeRsn(p.recipient_rsn) === normalized)
      .map((p) => ({ prize: p.prize, competition: payoutLabel(p) }));
  }

  let admin: {
    unpaidPayoutsCount: number;
    unpaidPayoutsTotal: string;
    pendingGnomieReviews: number;
    pendingTestimonials: number;
  } | null = null;

  const { data: payoutPerms } = await supabase
    .from("role_permissions")
    .select("role, permission, granted")
    .eq("permission", "manage_payouts");

  if (hasPermission(payoutPerms ?? [], identity.clanRank, "manage_payouts")) {
    const { data: unpaidPayouts } = await supabase
      .from("prize_payouts")
      .select("prize")
      .eq("is_paid", false);

    const { count: pendingGnomieReviews } = await supabase
      .from("gnomie_reviews")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: pendingTestimonials } = await supabase
      .from("testimonials")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    admin = {
      unpaidPayoutsCount: unpaidPayouts?.length ?? 0,
      // Prizes are free text (e.g. "6,500,000 GP", "Bond"), not a numeric
      // column -- summing them isn't meaningful, so this is a count-based
      // label instead of a real GP total.
      unpaidPayoutsTotal: `${unpaidPayouts?.length ?? 0} unpaid`,
      pendingGnomieReviews: pendingGnomieReviews ?? 0,
      pendingTestimonials: pendingTestimonials ?? 0,
    };
  }

  const points = await getPointsBalance(supabase, identity.userId);

  return NextResponse.json({
    member: { rsn: identity.rsn, clanRank: identity.clanRank, points },
    events,
    myPendingPrizes,
    admin,
  });
}
