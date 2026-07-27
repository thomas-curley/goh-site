import { NextResponse } from "next/server";
import { getGuildEmojis } from "@/lib/discord";

// GET - the server's custom emotes, for the admin emoji picker. Public and
// unauthenticated: this is non-sensitive reference data anyone in the
// Discord server can already see, matching the /api/items/search precedent.
export async function GET() {
  const emojis = await getGuildEmojis();
  return NextResponse.json({ emojis });
}
