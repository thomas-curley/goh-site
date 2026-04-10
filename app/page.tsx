import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CLAN_NAME, CLAN_CHAT, DISCORD_INVITE } from "@/lib/constants";
import { getGroupDetails, getGroupAchievements } from "@/lib/wom";
import { formatNumber } from "@/lib/utils";

export const revalidate = 3600; // ISR: revalidate every hour

export default async function HomePage() {
  const [groupDetails, achievements] = await Promise.all([
    getGroupDetails(),
    getGroupAchievements(5),
  ]);

  const memberCount = groupDetails?.memberships?.length ?? 0;
  const totalExp = groupDetails?.memberships?.reduce(
    (sum, m) => sum + (m.player.exp ?? 0),
    0
  ) ?? 0;
  const recentAchievementCount = achievements?.length ?? 0;

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

      {/* Quick Stats */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-display text-3xl text-gnome-green text-center mb-10">
          Clan at a Glance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="text-center">
            <p className="font-stats text-4xl text-gold font-bold">
              {memberCount > 0 ? memberCount : "--"}
            </p>
            <p className="text-bark-brown mt-1">Total Members</p>
          </Card>
          <Card className="text-center">
            <p className="font-stats text-4xl text-gold font-bold">
              {totalExp > 0 ? formatNumber(totalExp) : "--"}
            </p>
            <p className="text-bark-brown mt-1">Combined Total XP</p>
          </Card>
          <Card className="text-center">
            <p className="font-stats text-4xl text-gold font-bold">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gnome-green-light" />
                <div className="pl-4">
                  <p className="text-xs text-iron-grey uppercase tracking-wide mb-1">
                    Coming Soon
                  </p>
                  <h3 className="font-display text-lg text-bark-brown mb-2">
                    Event Placeholder
                  </h3>
                  <p className="text-sm text-iron-grey">
                    Events will appear here once the calendar is set up.
                  </p>
                </div>
              </Card>
            ))}
          </div>
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

      {/* Recent News */}
      <section className="bg-parchment-dark py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="font-display text-3xl text-gnome-green text-center mb-10">
            Latest News
          </h2>
          <div className="max-w-2xl mx-auto space-y-4">
            <Card>
              <p className="text-xs text-iron-grey mb-1">Announcement</p>
              <h3 className="font-display text-lg text-bark-brown">
                Welcome to the New Gn0me Home Website!
              </h3>
              <p className="text-sm text-bark-brown-light mt-2">
                We&apos;re building a new home for our clan on the web. Stay
                tuned for guides, event calendars, member profiles, and more.
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
