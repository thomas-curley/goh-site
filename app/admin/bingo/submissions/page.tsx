import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

interface PendingRow {
  id: string;
  bingo_tiles: { event_id: string; bingo_events: { id: string; name: string; status: string } | null } | null;
}

/**
 * Review Queue entry for bingo: every event with manual tile submissions
 * waiting on review, linking to that event's review page. (Gated by the
 * bingo section's layout -- manage_bingo.)
 */
export default async function BingoSubmissionsPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const counts = new Map<string, { name: string; status: string; pending: number }>();

  if (url && key) {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("bingo_tile_completions")
      .select("id, bingo_tiles(event_id, bingo_events(id, name, status))")
      .eq("status", "pending_review");
    for (const row of (data ?? []) as unknown as PendingRow[]) {
      const event = row.bingo_tiles?.bingo_events;
      if (!event) continue;
      const entry = counts.get(event.id) ?? { name: event.name, status: event.status, pending: 0 };
      entry.pending += 1;
      counts.set(event.id, entry);
    }
  }

  const events = [...counts.entries()].sort((a, b) => b[1].pending - a[1].pending);

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Bingo Submissions</h1>
      <p className="text-bark-brown-light mb-6">
        Screenshot submissions waiting for review, by event. All events are under{" "}
        <Link href="/admin/bingo" className="text-gnome-green hover:underline">Bingo</Link>.
      </p>

      {events.length === 0 ? (
        <Card hover={false}><p className="text-sm text-iron-grey">Nothing waiting for review.</p></Card>
      ) : (
        <div className="space-y-2">
          {events.map(([id, e]) => (
            <Card key={id} hover={false} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-bark-brown truncate">{e.name}</p>
                <p className="text-xs text-iron-grey capitalize">{e.status}</p>
              </div>
              <Link href={`/admin/bingo/${id}/review`} className="text-sm text-gnome-green hover:underline shrink-0">
                Review {e.pending} submission{e.pending === 1 ? "" : "s"} →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
