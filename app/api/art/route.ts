import { NextResponse } from "next/server";
import { artServiceClient, CONTEST_COLUMNS } from "@/lib/art-server";

// GET - art contests that aren't drafts, newest first, with entry counts.
export async function GET() {
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ contests: [] });
  const { data: contests } = await supabase.from("art_contests").select(CONTEST_COLUMNS).neq("status", "draft").order("created_at", { ascending: false });
  const ids = (contests ?? []).map((c) => c.id);
  const { data: entries } = ids.length ? await supabase.from("art_entries").select("contest_id, status").in("contest_id", ids) : { data: [] };
  return NextResponse.json({
    contests: (contests ?? []).map((c) => ({ ...c, entryCount: (entries ?? []).filter((e) => e.contest_id === c.id && e.status === "approved").length })),
  });
}
