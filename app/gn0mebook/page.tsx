import Link from "next/link";
import { getPublishedProfiles } from "@/lib/gn0mebook";
import { getRankByName } from "@/lib/constants";
import { ProfileCard } from "@/components/gn0mebook/ProfileCard";
import { Card } from "@/components/ui/Card";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gn0meBook",
  description: "Meet the people behind Gn0me Home -- who's running the clan, and who's in it.",
};

export const dynamic = "force-dynamic"; // gated per-viewer now, can't be statically cached

export default async function Gn0meBookPage() {
  if (!(await checkSectionAccess("gn0mebook"))) return <SectionUnavailable />;

  const profiles = await getPublishedProfiles();
  const founders = profiles.filter((p) => ["council_member", "owner"].includes(getRankByName(p.clan_rank ?? "")?.key ?? ""));
  const staff = profiles.filter((p) => ["yew", "pine", "oak"].includes(getRankByName(p.clan_rank ?? "")?.key ?? ""));
  const members = profiles.filter((p) => {
    const key = getRankByName(p.clan_rank ?? "")?.key ?? "";
    return !["council_member", "owner"].includes(key) && !["yew", "pine", "oak"].includes(key);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Gn0meBook</h1>
      <p className="text-bark-brown-light mb-10">
        Get to know the people behind Gn0me Home. Have a profile of your own?{" "}
        <Link href="/gn0mebook/edit" className="text-gnome-green hover:text-gnome-green-light underline">
          Set it up here
        </Link>
        .
      </p>

      {profiles.length === 0 ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light">No profiles published yet -- be the first!</p>
        </Card>
      ) : (
        <>
          {founders.length > 0 && (
            <section className="mb-12">
              <h2 className="font-display text-2xl text-gnome-green mb-4">Founders</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {founders.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}
              </div>
            </section>
          )}

          {staff.length > 0 && (
            <section className="mb-12">
              <h2 className="font-display text-2xl text-gnome-green mb-4">Staff</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {staff.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}
              </div>
            </section>
          )}

          {members.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-gnome-green mb-4">Members</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {members.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
