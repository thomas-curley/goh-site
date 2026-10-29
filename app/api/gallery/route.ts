import { NextRequest, NextResponse } from "next/server";
import { artServiceClient, ENTRY_COLUMNS, getArtViewer, signImages } from "@/lib/art-server";
import { creditName, type ArtEntry } from "@/lib/art";

const PAGE = 24;

// GET ?page=&contest= - the gallery: approved pieces from finished contests
// whose artists opted in (clan-only ones just for signed-in clan members).
export async function GET(request: NextRequest) {
  const supabase = artServiceClient();
  if (!supabase) return NextResponse.json({ pieces: [], total: 0 });
  const viewer = await getArtViewer(supabase);
  const page = Math.max(1, Math.floor(Number(request.nextUrl.searchParams.get("page")) || 1));
  const contestId = request.nextUrl.searchParams.get("contest");

  const { data: contests } = await supabase.from("art_contests").select("id, name, theme").eq("status", "completed").order("updated_at", { ascending: false });
  const finished = (contests ?? []).map((c) => c.id);
  if (finished.length === 0) return NextResponse.json({ pieces: [], total: 0, contests: [] });

  let query = supabase
    .from("art_entries")
    .select(ENTRY_COLUMNS, { count: "exact" })
    .eq("status", "approved")
    .eq("gallery_opt_in", true)
    .eq("gallery_hidden", false)
    .in("contest_id", contestId && finished.includes(contestId) ? [contestId] : finished)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (!viewer.clanMember && !viewer.isStaff) query = query.eq("visibility", "public");
  const { data, count } = await query;
  const pieces = (data ?? []) as ArtEntry[];
  const urls = await signImages(supabase, pieces.flatMap((e) => e.image_paths), 6 * 3600);
  return NextResponse.json({
    total: count ?? 0,
    pageSize: PAGE,
    contests: contests ?? [],
    pieces: pieces.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      images: e.image_paths.map((p) => urls[p]).filter(Boolean),
      artist: creditName(e),
      contest: (contests ?? []).find((c) => c.id === e.contest_id) ?? null,
      clanOnly: e.visibility === "clan",
    })),
  });
}
