import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_TITLE_LENGTH = 120;

// GET - every raffle, most recent first. Winners live on prize_payouts
// (raffle_id set), fetched separately by the admin page rather than joined
// here, since it already loads the full payouts list anyway.
export async function GET() {
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("raffles").select("*").order("occurred_on", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load raffles." }, { status: 500 });

  return NextResponse.json({ raffles: data ?? [] });
}

// POST - create a raffle. Winners are added afterward via the existing
// /api/admin/payouts POST with raffleId set, keeping one insert path for
// "a person is owed a prize" regardless of source.
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
  const occurredOn = typeof body.occurredOn === "string" && body.occurredOn ? body.occurredOn : new Date().toISOString().slice(0, 10);

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const { data, error } = await supabase
    .from("raffles")
    .insert({ title, occurred_on: occurredOn, created_by: user?.discord_username ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create raffle." }, { status: 500 });

  return NextResponse.json({ raffle: data }, { status: 201 });
}
