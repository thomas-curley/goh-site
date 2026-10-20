import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

const SIZES = [25, 50, 100];

// GET - one page of the clan feed log.
//   page, size (25/50/100), order (desc/asc by time)
//   status: all | counted | review | matched | nomatch | unread
//   source: a channel id (or droptracker-api)
//   kind: drop | collection_log | pet | quest
//   q: text search (player, item, quest)
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const supabase = createClient(url, key);

  const p = request.nextUrl.searchParams;
  const size = SIZES.includes(Number(p.get("size"))) ? Number(p.get("size")) : 25;
  const page = Math.max(1, Math.floor(Number(p.get("page")) || 1));
  const ascending = p.get("order") === "asc";

  let query = supabase
    .from("clan_feed_messages")
    .select("id, channel_id, author_name, posted_at, text, image_urls, events, outcomes", { count: "exact" })
    .order("posted_at", { ascending })
    .range((page - 1) * size, page * size - 1);

  switch (p.get("status")) {
    case "counted":
      query = query.contains("outcomes", [{ result: "counted" }]);
      break;
    case "review":
      query = query.contains("outcomes", [{ result: "queued" }]);
      break;
    case "matched":
      query = query.neq("outcomes", "[]");
      break;
    case "nomatch":
      query = query.neq("events", "[]").eq("outcomes", "[]");
      break;
    case "unread":
      query = query.eq("events", "[]");
      break;
  }
  const source = p.get("source");
  if (source) query = query.eq("channel_id", source);
  const kind = p.get("kind");
  if (kind && ["drop", "collection_log", "pet", "quest"].includes(kind)) query = query.contains("events", [{ kind }]);
  const q = (p.get("q") ?? "").replace(/[%_\\]/g, "").trim().slice(0, 60);
  if (q) query = query.ilike("text", `%${q}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "Couldn't load the log." }, { status: 500 });
  return NextResponse.json({ messages: data ?? [], total: count ?? 0, page, size });
}
