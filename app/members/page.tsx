import { MemberGrid } from "@/components/members/MemberGrid";
import { getGroupMembers } from "@/lib/wom";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Members",
  description: "View all members of the Gn0me Home OSRS clan.",
};

export const dynamic = "force-dynamic"; // gated per-viewer now, can't be statically cached

export default async function MembersPage() {
  if (!(await checkSectionAccess("members_list"))) return <SectionUnavailable />;

  const members = await getGroupMembers();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">
        Clan Members
      </h1>
      <p className="text-bark-brown-light mb-8">
        Browse the full roster of Gn0me Home. Data pulled from{" "}
        <a
          href="https://wiseoldman.net/groups/24582"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gnome-green hover:text-gnome-green-light underline"
        >
          Wise Old Man
        </a>
        .
      </p>
      <MemberGrid members={members} />
    </div>
  );
}
