import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { WEEKDAYS } from "@/lib/availability";
import type { AccessLevel } from "@/lib/clan-access";

const VALID_ACCESS_LEVELS: AccessLevel[] = ["anonymous", "verified_player", "clan_member"];
const MAX_DAYS = 31;
const MAX_TITLE_LENGTH = 100;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - list availability polls. Public callers get only active ones
// (?active=true); admins can list everything for the builder page.
export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const activeOnly = request.nextUrl.searchParams.get("active") === "true";

  let query = supabase.from("availability_polls").select("*").order("created_at", { ascending: false });
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load availability polls." }, { status: 500 });

  return NextResponse.json({ polls: data ?? [] });
}

// POST - create an availability poll.
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_availability");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));

  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const mode: "dates" | "weekly" = body.mode === "weekly" ? "weekly" : "dates";
  const days: string[] = Array.isArray(body.days)
    ? Array.from(new Set(body.days.filter((d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort() as string[]
    : [];
  const weekdays: string[] = Array.isArray(body.weekdays)
    ? Array.from(new Set(body.weekdays.filter((w: unknown) => typeof w === "string" && WEEKDAYS.includes(w))))
    : [];
  const startMinute = Number(body.startMinute);
  const endMinute = Number(body.endMinute);
  const slotMinutes = [15, 30, 60].includes(Number(body.slotMinutes)) ? Number(body.slotMinutes) : 30;
  const accessLevel: AccessLevel = VALID_ACCESS_LEVELS.includes(body.accessLevel) ? body.accessLevel : "anonymous";

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (mode === "dates" && (days.length === 0 || days.length > MAX_DAYS)) {
    return NextResponse.json({ error: `Pick between 1 and ${MAX_DAYS} days.` }, { status: 400 });
  }
  if (mode === "weekly" && weekdays.length === 0) {
    return NextResponse.json({ error: "Pick at least one day of the week." }, { status: 400 });
  }
  if (
    !Number.isInteger(startMinute) || !Number.isInteger(endMinute) ||
    startMinute < 0 || endMinute > 1440 || endMinute <= startMinute
  ) {
    return NextResponse.json({ error: "Invalid start/end time." }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("availability_polls")
    .insert({
      title,
      description: description || null,
      mode,
      days: mode === "dates" ? days : null,
      weekdays: mode === "weekly" ? weekdays : null,
      start_minute: startMinute,
      end_minute: endMinute,
      slot_minutes: slotMinutes,
      access_level: accessLevel,
      created_by: user?.discord_username ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "Failed to create availability poll." }, { status: 500 });

  return NextResponse.json({ id: inserted.id });
}
