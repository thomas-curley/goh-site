import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ingestFeedMessage } from "@/lib/clan-feed-server";
import type { FeedEmbed, FeedMessage } from "@/lib/clan-feed";

// Clan feed endpoints for the Discord bot (Bearer DISCORD_WEBHOOK_SECRET).
//   GET   the channel ids to watch
//   POST  one post from a watched channel (by a bot or webhook)

function authorized(request: NextRequest) {
  const secret = process.env.DISCORD_WEBHOOK_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : null);

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = serviceClient();
  if (!supabase) return NextResponse.json({ channelIds: [] });
  const { data } = await supabase.from("clan_feed_channels").select("channel_id");
  return NextResponse.json({ channelIds: (data ?? []).map((c) => c.channel_id) });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = serviceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));

  const messageId = str(body.messageId, 30);
  const channelId = str(body.channelId, 30);
  if (!messageId || !channelId) return NextResponse.json({ error: "messageId and channelId are required." }, { status: 400 });
  const { data: watched } = await supabase.from("clan_feed_channels").select("channel_id").eq("channel_id", channelId).maybeSingle();
  if (!watched) return NextResponse.json({ error: "That channel isn't a clan feed." }, { status: 403 });

  const embeds: FeedEmbed[] = (Array.isArray(body.embeds) ? body.embeds.slice(0, 10) : []).map((e: Record<string, unknown>) => ({
    authorName: str(e?.authorName, 256),
    title: str(e?.title, 256),
    description: str(e?.description),
    fields: (Array.isArray(e?.fields) ? e.fields.slice(0, 25) : []).map((f: Record<string, unknown>) => ({ name: str(f?.name, 256) ?? "", value: str(f?.value, 1024) ?? "" })),
    footer: str(e?.footer, 2048),
    imageUrl: str(e?.imageUrl, 1000),
    thumbnailUrl: str(e?.thumbnailUrl, 1000),
  }));
  const postedAt = str(body.postedAt, 40);
  const msg: FeedMessage = {
    messageId,
    channelId,
    authorName: str(body.authorName, 100),
    postedAt: postedAt && !Number.isNaN(Date.parse(postedAt)) ? new Date(postedAt).toISOString() : new Date().toISOString(),
    content: str(body.content) ?? "",
    embeds,
    attachmentUrls: (Array.isArray(body.attachmentUrls) ? body.attachmentUrls : []).map((u: unknown) => str(u, 1000)).filter((u: string | null): u is string => !!u).slice(0, 4),
  };
  const result = await ingestFeedMessage(supabase, msg);
  return NextResponse.json({ events: result.events.length, counted: result.outcomes.filter((o) => o.result === "counted" || o.result === "queued").length, skipped: !!result.skipped });
}
