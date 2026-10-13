import type { Metadata } from "next";
import { getGroupMembers } from "@/lib/wom";
import { checkStaffViewer } from "@/lib/staff-gate";
import { MemberDirectory } from "@/components/profiles/MemberDirectory";
import { StaffOnly } from "@/components/profiles/StaffOnly";

export const metadata: Metadata = { title: "Member Profiles (Beta)" };
export const dynamic = "force-dynamic";

// /members/beta -- staff-only index of the "logs"-style profiles (beta).
export default async function MemberProfilesBetaPage() {
  const access = await checkStaffViewer("member profiles (beta)");
  if (!access.eligible) return <StaffOnly title="Member Profiles (Beta)" reason={access.reason} />;

  const members = (await getGroupMembers())
    .map((m) => ({ displayName: m.displayName, role: m.role, ehp: m.ehp, ehb: m.ehb, exp: m.exp }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-iron-grey">Beta · staff only</p>
      <h1 className="font-display text-4xl text-gnome-green mt-1">Member Profiles</h1>
      <p className="text-bark-brown-light mt-2 mb-6 max-w-2xl">
        Each member&apos;s outfit, headline stats, and every boss and skill coloured by where they rank in the clan, like the
        parse colours on Warcraft Logs or FF Logs. Pick a member to open their profile.
      </p>
      {members.length === 0 ? (
        <p className="text-sm text-iron-grey">Couldn&apos;t load the clan roster from Wise Old Man right now.</p>
      ) : (
        <MemberDirectory members={members} />
      )}
    </div>
  );
}
