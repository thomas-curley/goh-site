import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_ITEMS = 100;
const MAX_NAME_LENGTH = 120;

interface LootItem {
  name: string;
  unitPrice: number;
  qty: number;
}

// GET - fetch loot tracked for an event. Public, matches /attendance.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data } = await supabase.from("event_loot").select("items").eq("event_id", id).maybeSingle();
  return NextResponse.json({ items: data?.items ?? [] });
}

// PUT - save (upsert) loot for an event using the caller's own authenticated
// session. Identity is always read from the session/profile, never trusted
// from the request body.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in to save loot." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("discord_username")
    .eq("id", user.id)
    .maybeSingle();

  const { data: event } = await supabase.from("events").select("id").eq("id", id).maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Too many items (max ${MAX_ITEMS}).` }, { status: 400 });
  }

  const items: LootItem[] = rawItems
    .filter((r: unknown): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      name: typeof r.name === "string" ? r.name.trim().slice(0, MAX_NAME_LENGTH) : "",
      unitPrice: Number.isFinite(Number(r.unitPrice)) ? Math.max(0, Number(r.unitPrice)) : 0,
      qty: Number.isFinite(Number(r.qty)) ? Math.max(1, Math.floor(Number(r.qty))) : 1,
    }))
    .filter((r) => r.name);

  const { error } = await supabase
    .from("event_loot")
    .upsert(
      {
        event_id: id,
        items,
        updated_by: profile?.discord_username ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" }
    );

  if (error) return NextResponse.json({ error: "Failed to save loot." }, { status: 500 });

  return NextResponse.json({ saved: true, items });
}
