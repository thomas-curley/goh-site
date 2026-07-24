import { NextRequest, NextResponse } from "next/server";
import { runAnnouncementsImport, runEventsImport } from "@/lib/discord-import";

/**
 * Daily cron target that runs both Discord imports (announcements + events)
 * back to back. A single cron entry rather than one each, to stay well
 * under Vercel's per-plan cron job count limits -- the existing per-page
 * "Import from Discord" buttons keep working unchanged, this just automates
 * the same thing daily. Both imports are already dedupe-safe (skip
 * anything with a discord_message_id/discord_event_id already seen), so
 * running them repeatedly is harmless.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [announcements, events] = await Promise.all([
    runAnnouncementsImport(),
    runEventsImport(),
  ]);

  if (!announcements.ok) console.error("Scheduled announcements import failed:", announcements.message);
  if (!events.ok) console.error("Scheduled events import failed:", events.message);

  return NextResponse.json({ announcements, events });
}
