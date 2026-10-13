import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const WIKI_API = "https://oldschool.runescape.wiki/api.php";

// GET ?q=gnome sc - item name suggestions from the OSRS Wiki's search, for
// the outfit pickers. Signed-in users only (it proxies a third-party API).
// The wiki search returns any page title, not just items; the picker hides
// results with no item icon.
export async function GET(request: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to search items." }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });

  const url = `${WIKI_API}?action=opensearch&format=json&namespace=0&limit=12&search=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Gn0meHome-Website (clan site outfit picker)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ items: [], error: "Item search is unavailable right now." }, { status: 502 });
    const data = (await res.json()) as [string, string[]];
    return NextResponse.json({ items: (data[1] ?? []).map((name) => ({ name })) });
  } catch {
    return NextResponse.json({ items: [], error: "Item search is unavailable right now." }, { status: 502 });
  }
}
