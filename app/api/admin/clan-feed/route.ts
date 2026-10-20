import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { applyFeedEvents } from "@/lib/clan-feed-server";
import { parseFeedMessage, type FeedEvent } from "@/lib/clan-feed";
import { DROPTRACKER_CHANNEL, droptrackerConfigured, droptrackerStatus, pollDroptracker } from "@/lib/droptracker";

export const maxDuration = 300;

async function context() {
  const { allowed } = await checkPermission("manage_settings");
  if (!allowed) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  return { supabase: createClient(url, key) };
}

// GET - the watched channels and the DropTracker API status (the log is /log).
export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const [{ data: channels }, { data: source }] = await Promise.all([
    ctx.supabase.from("clan_feed_channels").select("channel_id, label, created_at").order("created_at"),
    ctx.supabase.from("clan_feed_sources").select("last_polled_at, last_result").eq("source", DROPTRACKER_CHANNEL).maybeSingle(),
  ]);
  return NextResponse.json({
    channels: channels ?? [],
    droptracker: { configured: droptrackerConfigured(), lastPolledAt: source?.last_polled_at ?? null, lastResult: source?.last_result ?? null },
  });
}

// PUT { channels: [{ channel_id, label }] } - replace the watched channels.
export async function PUT(request: NextRequest) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const body = await request.json().catch(() => ({}));
  const channels = (Array.isArray(body.channels) ? body.channels : [])
    .filter((c: { channel_id?: unknown }) => typeof c?.channel_id === "string" && /^\d{5,30}$/.test(c.channel_id))
    .slice(0, 20)
    .map((c: { channel_id: string; label?: unknown }) => ({ channel_id: c.channel_id, label: typeof c.label === "string" ? c.label.slice(0, 100) : null }));
  await ctx.supabase.from("clan_feed_channels").delete().neq("channel_id", "");
  if (channels.length) await ctx.supabase.from("clan_feed_channels").insert(channels);
  return NextResponse.json({ saved: true });
}

// POST
//   { action: "test", content, title?, description? }  read a pasted post and
//       say what it would count for, without counting anything
//   { action: "replay", id }  run a logged post again (say, after adding the
//       player to the event)
export async function POST(request: NextRequest) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const body = await request.json().catch(() => ({}));

  if (body.action === "test") {
    const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 4000) : "");
    const events = parseFeedMessage({ content: s(body.content), embeds: s(body.title) || s(body.description) ? [{ title: s(body.title), description: s(body.description) }] : [] });
    const outcomes = await applyFeedEvents(ctx.supabase, events, new Date().toISOString(), [], { dryRun: true });
    return NextResponse.json({ events, outcomes });
  }

  if (body.action === "poll") {
    // "Check now": tests the key and reads the feed even if no bingo is live.
    const status = await droptrackerStatus();
    if (!status.configured) return NextResponse.json({ error: "Add DROPTRACKER_API_KEY in Vercel first." }, { status: 400 });
    if (!status.ok) return NextResponse.json({ error: status.error }, { status: 502 });
    return NextResponse.json({ groupId: status.groupId, result: await pollDroptracker(ctx.supabase, { force: true }) });
  }

  if (body.action === "replay") {
    const { data: row } = await ctx.supabase.from("clan_feed_messages").select("id, posted_at, image_urls, events").eq("id", body.id).maybeSingle();
    if (!row) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const outcomes = await applyFeedEvents(ctx.supabase, row.events as FeedEvent[], row.posted_at, row.image_urls ?? []);
    await ctx.supabase.from("clan_feed_messages").update({ outcomes }).eq("id", row.id);
    return NextResponse.json({ outcomes });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
