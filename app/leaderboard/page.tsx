import { AttendanceLeaderboard } from "@/components/leaderboard/AttendanceLeaderboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attendance Leaderboard",
  description: "See who's showing up to Gn0me Home events and how attendance has changed over time.",
};

export default function LeaderboardPage() {
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
