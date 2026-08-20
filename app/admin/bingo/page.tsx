"use client";

import { BingoEventForm } from "@/components/admin/bingo/BingoEventForm";

export default function CreateBingoEventPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Forge New Bingo Event</h1>
      <p className="text-bark-brown-light mb-6">Define the board, teams, and tiles for a new clan bingo event.</p>
      <BingoEventForm />
    </div>
  );
}
