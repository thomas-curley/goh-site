import { AttendanceLeaderboard } from "@/components/leaderboard/AttendanceLeaderboard";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attendance Leaderboard",
  description: "See who's showing up to Gn0me Home events and how attendance has changed over time.",
};

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  if (!(await checkSectionAccess("leaderboard"))) return <SectionUnavailable />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Attendance Leaderboard</h1>
      <p className="text-bark-brown-light mb-8">
        Ranked by events checked into. Attendees are eligible for the weekly raffle — the more
        events you attend, the more chances you get.
      </p>

      <AttendanceLeaderboard />
    </div>
  );
}
