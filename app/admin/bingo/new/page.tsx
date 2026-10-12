"use client";

import Link from "next/link";
import { BingoEventForm } from "@/components/admin/bingo/BingoEventForm";

export default function CreateBingoEventPage() {
  return (
    <div>
      <Link href="/admin/bingo" className="text-sm text-gnome-green hover:underline">← Back to Bingo Events</Link>
      <h1 className="font-display text-3xl text-gnome-green mt-2 mb-1">New Bingo Event</h1>
      <p className="text-bark-brown-light mb-6">Define the board, teams, and tiles for a new clan bingo event.</p>
      <BingoEventForm />
    </div>
  );
}
