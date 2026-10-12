import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { getAlertChannel } from "@/lib/alert-channels";
import { createForumPost, isDiscordSnowflake, postToChannel } from "@/lib/discord";
import { splitDiscordMessage } from "@/lib/weekly-announcement-templates";

export const maxDuration = 60;

type Step = "results" | "forum" | "raffle";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Posts an already-split message as consecutive messages in one channel/thread. */
async function postChunks(chunks: string[], channelId: string) {
  for (const chunk of chunks) {
    await postToChannel(channelId, chunk);
  }
}

// POST - send the (admin-edited) turnover posts, in order:
//   1. results  -> reply in last week's forum thread
//   2. forum    -> new thread for this week (split across messages if long)
//   3. raffle   -> announcements channel
// Each step is optional (omit it to skip, e.g. on a retry after a partial
// failure). Stops at the first failure and reports which steps went out, so
// the page can retry just the rest. As soon as the new forum thread exists,
// it's saved (with the competitions it's for) as "this week" -- next week's
// form prefills from that.
export async function POST(request: NextRequest) {
  const { allowed } = await checkPermission("manage_competitions");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const completed: Step[] = [];
  let forumThreadId: string | null = null;
  let rotated = false;

  const fail = (step: Step, err: unknown, status = 502) => {
    console.error(`Weekly turnover: ${step} post failed:`, err);
    return NextResponse.json(
      { completed, forumThreadId, rotated, failed: step, error: `The ${step} post failed: ${err instanceof Error ? err.message : String(err)}` },
      { status }
    );
  };

  // 1. Results in last week's thread.
  if (body.results) {
    const threadId = text(body.results.channelId);
    const content = text(body.results.content);
    if (!isDiscordSnowflake(threadId) || !content) return fail("results", new Error("missing thread or content"), 400);
    try {
      await postChunks(splitDiscordMessage(content), threadId);
      completed.push("results");
    } catch (err) {
      return fail("results", err);
    }
    await sleep(1500);
  }

  // 2. New week's forum thread.
  if (body.forum) {
    const title = text(body.forum.title);
    const content = text(body.forum.content);
    const imageUrl = text(body.forum.imageUrl);
    if (!title || !content) return fail("forum", new Error("missing title or content"), 400);
    if (imageUrl && !/^https:\/\//.test(imageUrl)) return fail("forum", new Error("image URL must start with https://"), 400);

    const forumChannelId = await getAlertChannel(supabase, "skill_or_kill_forum");
    if (!forumChannelId) return fail("forum", new Error("no Skill or Kill of the Week Forum channel configured"), 400);

    const nextIds: number[] = Array.isArray(body.nextIds) ? body.nextIds.map(Number).filter((n: number) => Number.isInteger(n)) : [];
    const nextType = body.nextType === "sotw" || body.nextType === "botw" ? body.nextType : null;
    if (nextIds.length === 0 || !nextType) return fail("forum", new Error("missing next week's competition"), 400);

    const chunks = splitDiscordMessage(content);
    try {
      // The image goes on the last message so it shows at the bottom, like the hand-made posts.
      const starterImage = chunks.length === 1 && imageUrl ? imageUrl : undefined;
      const thread = await createForumPost(forumChannelId, title, chunks[0], starterImage);
      forumThreadId = thread.threadId;
      for (let i = 1; i < chunks.length; i++) {
        await postToChannel(thread.threadId, chunks[i], i === chunks.length - 1 && imageUrl ? imageUrl : undefined);
      }
      completed.push("forum");
    } catch (err) {
      // A thread that got created but whose follow-ups failed still counts
      // as the new week -- rotate anyway so the thread id isn't lost.
      if (!forumThreadId) return fail("forum", err);
      console.error("Weekly turnover: forum follow-up message failed:", err);
    }

    const startDate = new Date(text(body.startDate));
    const { error: rotateError } = await supabase
      .from("weekly_competition_config")
      .update({
        current_competition_ids: nextIds,
        current_competition_type: nextType,
        current_competition_name: text(body.nextName).slice(0, 150) || null,
        current_week_start_date: Number.isNaN(startDate.getTime()) ? new Date().toISOString().slice(0, 10) : startDate.toISOString().slice(0, 10),
        current_forum_thread_id: forumThreadId,
        current_competition_emoji: text(body.nextEmoji).slice(0, 32) || null,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (rotateError) {
      console.error("Weekly turnover: rotation failed:", rotateError);
      return NextResponse.json(
        { completed, forumThreadId, rotated, failed: "forum", error: "The forum thread was posted, but saving it as this week's thread failed -- paste its link into the form next week." },
        { status: 500 }
      );
    }
    rotated = true;
    if (!completed.includes("forum")) {
      return NextResponse.json(
        { completed, forumThreadId, rotated, failed: "forum", error: "The forum thread was created, but part of its content failed to post -- add the rest by hand in the thread." },
        { status: 502 }
      );
    }
    await sleep(1500);
  }

  // 3. Raffle winners in announcements.
  if (body.raffle) {
    const content = text(body.raffle.content);
    if (!content) return fail("raffle", new Error("missing content"), 400);
    const announcementsChannelId = await getAlertChannel(supabase, "weekly_competition_announcements");
    if (!announcementsChannelId) return fail("raffle", new Error("no Weekly SOTW/BotW Announcements channel configured"), 400);
    try {
      await postChunks(splitDiscordMessage(content), announcementsChannelId);
      completed.push("raffle");
    } catch (err) {
      return fail("raffle", err);
    }
  }

  return NextResponse.json({ completed, forumThreadId, rotated });
}
