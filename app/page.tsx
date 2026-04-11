import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CLAN_NAME, CLAN_CHAT, DISCORD_INVITE } from "@/lib/constants";
import { getGroupDetails, getGroupAchievements } from "@/lib/wom";
import { AchievementsTicker } from "@/components/home/AchievementsTicker";
import { formatNumber } from "@/lib/utils";
import { createClient } from "@supabase/supabase-js";
import { EVENT_TYPES } from "@/lib/constants";

export const revalidate = 300; // ISR: revalidate every 5 minutes

async function getUpcomingEvents() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  const { data } = await supabase
    .from("events")
    .select("id, title, event_type, start_time, host_rsn, world, location, meet_location")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(3);

  return data ?? [];
}

async function getAnnouncements() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, content, category, pinned, author_name, created_at")
    .eq("published", true)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Failed to fetch announcements:", error);
    return [];
  }

  return data ?? [];
}

export default async function HomePage() {
  const [groupDetails, achievements, upcomingEvents, announcements] = await Promise.all([
    getGroupDetails(),
    getGroupAchievements(50),
    getUpcomingEvents(),
    getAnnouncements(),
  ]);

  const memberCount = groupDetails?.memberships?.length ?? 0;
  const totalExp = groupDetails?.memberships?.reduce(
    (sum, m) => sum + (m.player.exp ?? 0),
    0
  ) ?? 0;

  // Deduplicate achievements: max 2 per player for variety
  const playerCounts = new Map<number, number>();
  const diverseAchievements = (achievements ?? []).filter((a: { playerId: number }) => {
    const count = playerCounts.get(a.playerId) ?? 0;
    if (count >= 2) return false;
    playerCounts.set(a.playerId, count + 1);
    return true;
  }).slice(0, 15);

  const recentAchievementCount = diverseAchievements.length;

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gnome-green overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M20%200L40%2020L20%2040L0%2020Z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 py-24 text-center">
          <h1 className="font-display text-6xl md:text-7xl text-gold-light mb-4 text-shadow">
            {CLAN_NAME}
          </h1>
          <p className="text-xl md:text-2xl text-parchment mb-8 max-w-2xl mx-auto">
            An Old School RuneScape community built on friendship, adventure,
            and the occasional gnome pun.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
              <Button size="lg">Join Our Discord</Button>
            </a>
            <Link href="/members">
              <Button variant="secondary" size="lg">
                View Members
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Achievements Ticker */}
      <AchievementsTicker achievements={diverseAchievements as unknown as { playerId: number; name: string; metric: string; threshold: number; createdAt: Date; player?: { displayName: string } }[]} />

      {/* Quick Stats */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-display text-3xl text-gnome-green text-center mb-10">
          Clan at a Glance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="text-center">
            <p className="font-stats text-4xl text-gold-display font-bold">
              {memberCount > 0 ? memberCount : "--"}
            </p>
            <p className="text-bark-brown mt-1">Total Members</p>
          </Card>
          <Card className="text-center">
            <p className="font-stats text-4xl text-gold-display font-bold">
              {totalExp > 0 ? formatNumber(totalExp) : "--"}
            </p>
            <p className="text-bark-brown mt-1">Combined Total XP</p>
          </Card>
          <Card className="text-center">
            <p className="font-stats text-4xl text-gold-display font-bold">
              {recentAchievementCount > 0 ? `${recentAchievementCount}+` : "--"}
            </p>
            <p className="text-bark-brown mt-1">Recent Achievements</p>
          </Card>
        </div>
      </section>

      {/* Upcoming Events Preview */}
      <section className="bg-parchment-dark py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="font-display text-3xl text-gnome-green text-center mb-10">
            Upcoming Events
          </h2>
          {upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => {
                const eventType = EVENT_TYPES.find((t) => t.key === event.event_type);
                const startDate = new Date(event.start_time);
                return (
                  <Card key={event.id} className="relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ backgroundColor: eventType?.color ?? "#6B6B6B" }}
                    />
                    <div className="pl-4">
                      <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">
                        {startDate.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {" · "}
                        {startDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <h3 className="font-display text-lg text-bark-brown mb-1">
                        {event.title}
                      </h3>
                      <div className="text-sm text-iron-grey space-y-0.5">
                        {event.host_rsn && (
                          <p>Host: <span className="font-mono">{event.host_rsn}</span></p>
                        )}
                        {event.world && <p>World {event.world}</p>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-iron-grey py-8">
              <p className="font-display text-xl mb-2">No upcoming events</p>
              <p className="text-sm">Check our Discord for the latest event announcements.</p>
            </div>
          )}
          <div className="text-center mt-8">
            <Link href="/events">
              <Button variant="ghost">View All Events</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Join Us CTA */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <Card className="text-center py-12 px-6" hover={false}>
          <h2 className="font-display text-3xl text-gnome-green mb-4">
            Ready to Join?
          </h2>
          <p className="text-bark-brown-light mb-6 max-w-xl mx-auto">
            Whether you&apos;re a seasoned veteran or just getting started in
            Gielinor, there&apos;s a place for you in {CLAN_NAME}. Join our clan
            chat and say hello!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="text-center">
              <p className="text-sm text-iron-grey mb-1">In-Game Clan Chat</p>
              <p className="font-mono text-lg text-gnome-green font-bold">
                {CLAN_CHAT}
              </p>
            </div>
            <span className="hidden sm:inline text-parchment-dark text-2xl">
              |
            </span>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
              <Button>Join Discord</Button>
            </a>
          </div>
        </Card>
      </section>

      {/* Latest News */}
      <section className="bg-parchment-dark py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="font-display text-3xl text-gnome-green text-center mb-10">
            Latest News
          </h2>
          <div className="max-w-2xl mx-auto space-y-4">
            {announcements.length > 0 ? (
              announcements.map((a) => (
                <Card key={a.id}>
                  <div className="flex items-center gap-2 mb-1">
                    {a.pinned && <span className="text-xs">📌</span>}
                    <p className="text-xs text-iron-grey uppercase tracking-wide">
                      {a.category.replace(/_/g, " ")}
                    </p>
                    <span className="text-xs text-iron-grey">·</span>
                    <p className="text-xs text-iron-grey">
                      {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <h3 className="font-display text-lg text-bark-brown">
                    {a.title}
                  </h3>
                  <p className="text-sm text-bark-brown-light mt-2 line-clamp-3">
                    {a.content}
                  </p>
                  {a.author_name && (
                    <p className="text-xs text-iron-grey mt-2">— {a.author_name}</p>
                  )}
                </Card>
              ))
            ) : (
              <Card>
                <p className="text-xs text-iron-grey mb-1">Announcement</p>
                <h3 className="font-display text-lg text-bark-brown">
                  Welcome to the Gn0me Home Website!
                </h3>
                <p className="text-sm text-bark-brown-light mt-2">
                  Your home for guides, event calendars, member profiles,
                  and more. Check back for news and updates.
                </p>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
