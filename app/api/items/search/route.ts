import { NextRequest, NextResponse } from "next/server";
import { searchItems } from "@/lib/osrs-prices";

// Public, read-only lookup against the OSRS Wiki's live GE prices — no auth needed.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await searchItems(q);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Item search failed:", err);
    return NextResponse.json({ error: "Failed to search items." }, { status: 502 });
  }
}
