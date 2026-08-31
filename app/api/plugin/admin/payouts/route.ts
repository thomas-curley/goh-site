import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPluginToken } from "@/lib/plugin-auth";
import { hasPermission } from "@/lib/permissions";
import { payoutLabel, type PayoutSourceRow } from "@/lib/payouts";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface PayoutRow extends PayoutSourceRow {
  id: string;
  recipient_rsn: string;
  prize: string;
}

/**
 * GET /api/plugin/admin/payouts -- the unpaid-payouts list backing the
 * plugin's Admin Backlog drill-down. Separate from /api/plugin/reminders
 * (which only carries a count) since the RSN/prize detail here is only
 * useful to someone with manage_payouts -- no reason to bloat the digest
 * every member polls every 5 minutes with data almost none of them need.
 */
export async function GET(request: NextRequest) {
  const identity = await verifyPluginToken(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: perms } = await supabase
    .from("role_permissions")
    .select("role, permission, granted")
    .eq("permission", "manage_payouts");

  if (!hasPermission(perms ?? [], identity.clanRank, "manage_payouts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("prize_payouts")
    .select("id, recipient_rsn, prize, source_detail, wom_competitions(title), events(title), raffles(title)")
    .eq("is_paid", false)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Failed to load payouts." }, { status: 500 });

  const typed = (data ?? []) as unknown as PayoutRow[];
  const payouts = typed.map((p) => ({
    id: p.id,
    recipientRsn: p.recipient_rsn,
    prize: p.prize,
    competition: payoutLabel(p),
  }));

  return NextResponse.json({ payouts });
}
