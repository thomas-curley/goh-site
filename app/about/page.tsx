import { Card } from "@/components/ui/Card";
import { RankBadge } from "@/components/ui/RankBadge";
import { CLAN_NAME, CLAN_CHAT, DISCORD_INVITE, RANKS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: `Learn about ${CLAN_NAME}, our history, values, rank structure, and how to join.`,
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-8">
        About {CLAN_NAME}
      </h1>

      {/* Clan Story */}
      <section className="mb-12">
        <Card hover={false}>
          <h2 className="font-display text-2xl text-gnome-green mb-4">Our Story</h2>
          <div className="space-y-3 text-bark-brown-light leading-relaxed">
            <p>
              {CLAN_NAME}{" "}is an Old School RuneScape clan built around community,
              PvM progression, and having fun in Gielinor. Whether you&apos;re a
              seasoned veteran hunting Inferno capes or a fresh adventurer just
              leaving Tutorial Island, there&apos;s a place for you here.
            </p>
            <p>
              We run weekly events ranging from PvM bingo and boss masses to
              skilling competitions and drop parties. Our members help each other
              learn raids, grind bosses, and tackle the Collection Log.
            </p>
          </div>
        </Card>
      </section>

      {/* Values */}
      <section className="mb-12">
        <h2 className="font-display text-2xl text-gnome-green mb-4">Our Values</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card hover={false} className="text-center">
            <h3 className="font-display text-lg text-bark-brown mb-2">Community</h3>
            <p className="text-sm text-bark-brown-light">
              We&apos;re a social clan first. Respect, inclusion, and good vibes
              are non-negotiable.
            </p>
          </Card>
          <Card hover={false} className="text-center">
            <h3 className="font-display text-lg text-bark-brown mb-2">Progression</h3>
            <p className="text-sm text-bark-brown-light">
              We encourage growth — whether that&apos;s your first Fire Cape or
              your 500th CoX completion.
            </p>
          </Card>
          <Card hover={false} className="text-center">
            <h3 className="font-display text-lg text-bark-brown mb-2">Fun</h3>
            <p className="text-sm text-bark-brown-light">
              Events, competitions, banter, and the occasional gnome pun. We
              don&apos;t take ourselves too seriously.
            </p>
          </Card>
        </div>
      </section>

      {/* Rank Structure */}
      <section className="mb-12">
        <h2 className="font-display text-2xl text-gnome-green mb-4">Rank Structure</h2>
        <Card hover={false}>
          <div className="space-y-4">
            {[...RANKS].reverse().map((rank) => (
              <div key={rank.key} className="flex items-start gap-4 pb-4 border-b border-parchment-dark last:border-0 last:pb-0">
                <RankBadge rank={rank.name} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-bark-brown">{rank.name}</p>
                  <p className="text-sm text-bark-brown-light">
                    {rank.key === "council_member" && "Clan leadership — Owner and Summoner ranks in WOM. Manages events, guides, and clan operations with full admin access."}
                    {rank.key === "yew" && "Experienced and trusted members who contribute actively to the clan."}
                    {rank.key === "pine" && "Established members who participate regularly in events and activities."}
                    {rank.key === "oak" && "Members who have been around a while and proven themselves."}
                    {rank.key === "gnome_child" && "Welcome! New members start here. Join events and get to know us."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* How to Join */}
      <section className="mb-12">
        <h2 className="font-display text-2xl text-gnome-green mb-4">How to Join</h2>
        <Card hover={false}>
          <ol className="space-y-4 text-bark-brown-light">
            <li className="flex gap-3">
              <span className="font-stats font-bold text-gold text-lg">1.</span>
              <div>
                <p className="font-bold text-bark-brown">Join the Clan Chat</p>
                <p className="text-sm">
                  Type <span className="font-mono text-gnome-green font-bold">{CLAN_CHAT}</span> in
                  the clan chat tab in-game.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-stats font-bold text-gold text-lg">2.</span>
              <div>
                <p className="font-bold text-bark-brown">Join the Discord</p>
                <p className="text-sm">
                  Hop into our Discord server to stay connected and chat with the clan.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-stats font-bold text-gold text-lg">3.</span>
              <div>
                <p className="font-bold text-bark-brown">Say Hello!</p>
                <p className="text-sm">
                  Introduce yourself and start joining events. Ranks are earned
                  through participation and time.
                </p>
              </div>
            </li>
          </ol>
          <div className="mt-6 text-center">
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
              <Button size="lg">Join Our Discord</Button>
            </a>
          </div>
        </Card>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="font-display text-2xl text-gnome-green mb-4">FAQ</h2>
        <div className="space-y-3">
          {[
            {
              q: "Are there any requirements to join?",
              a: "No requirements! We welcome players of all levels and account types.",
            },
            {
              q: "How do I rank up?",
              a: "Ranks are earned through activity, event participation, and time in the clan. Council members review promotions regularly.",
            },
            {
              q: "Do you do learner raids?",
              a: "Yes! We run learner sessions for CoX, ToB, and ToA. Ask in Discord for the next one.",
            },
            {
              q: "What timezone are events in?",
              a: "Most events are in EST/CST but we have members across multiple timezones. Events are posted with UTC times.",
            },
          ].map((item) => (
            <Card key={item.q} hover={false}>
              <h3 className="font-bold text-bark-brown mb-1">{item.q}</h3>
              <p className="text-sm text-bark-brown-light">{item.a}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
