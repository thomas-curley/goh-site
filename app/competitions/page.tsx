import { getGroupCompetitions } from "@/lib/wom";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Competitions",
  description: "View active and past Gn0me Home clan competitions from Wise Old Man.",
};

export const revalidate = 3600;

export default async function CompetitionsPage() {
  const competitions = await getGroupCompetitions();

  const now = new Date();
  const active = competitions.filter(
    (c) => new Date(c.startsAt) <= now && new Date(c.endsAt) >= now
  );
  const upcoming = competitions.filter(
    (c) => new Date(c.startsAt) > now
  );
  const past = competitions
    .filter((c) => new Date(c.endsAt) < now)
    .slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">
        Competitions
      </h1>
      <p className="text-bark-brown-light mb-10">
        Clan competitions tracked through{" "}
        <a
          href="https://wiseoldman.net/groups/24582/competitions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gnome-green hover:text-gnome-green-light underline"
        >
          Wise Old Man
        </a>
        .
      </p>

      {/* Active Competitions */}
      {active.length > 0 && (
        <section className="mb-12">
          <h2 className="font-display text-2xl text-gnome-green mb-4">
            Active Now
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map((comp) => (
              <CompetitionCard key={comp.id} comp={comp} status="active" />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mb-12">
          <h2 className="font-display text-2xl text-gnome-green mb-4">
            Upcoming
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.map((comp) => (
              <CompetitionCard key={comp.id} comp={comp} status="upcoming" />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      <section>
        <h2 className="font-display text-2xl text-gnome-green mb-4">
          Past Competitions
        </h2>
        {past.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {past.map((comp) => (
              <CompetitionCard key={comp.id} comp={comp} status="past" />
            ))}
          </div>
        ) : (
          <p className="text-iron-grey">No past competitions found.</p>
        )}
      </section>
    </div>
  );
}

function CompetitionCard({
  comp,
  status,
}: {
  comp: { id: number; title: string; metric: string; type: string; startsAt: Date; endsAt: Date };
  status: "active" | "upcoming" | "past";
}) {
  const statusColors = {
    active: "bg-gnome-green text-text-light",
    upcoming: "bg-gold text-bark-brown",
    past: "bg-iron-grey text-text-light",
  };

  const start = new Date(comp.startsAt);
  const end = new Date(comp.endsAt);

  return (
    <a
      href={`https://wiseoldman.net/competitions/${comp.id}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Card className="h-full">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg text-bark-brown truncate">
            {comp.title}
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ml-2 ${statusColors[status]}`}>
            {status === "active" ? "Live" : status === "upcoming" ? "Upcoming" : "Ended"}
          </span>
        </div>
        <div className="text-sm text-bark-brown-light space-y-1">
          <p>
            <span className="text-iron-grey">Metric: </span>
            <span className="capitalize">{comp.metric.replace(/_/g, " ")}</span>
          </p>
          <p>
            <span className="text-iron-grey">Type: </span>
            <span className="capitalize">{comp.type}</span>
          </p>
          <p>
            <span className="text-iron-grey">Period: </span>
            {start.toLocaleDateString()} — {end.toLocaleDateString()}
          </p>
        </div>
        <span className="text-sm text-gnome-green font-semibold mt-3 inline-block">
          View on WOM &rarr;
        </span>
      </Card>
    </a>
  );
}
