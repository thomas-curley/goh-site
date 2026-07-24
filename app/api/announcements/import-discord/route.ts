import { NextResponse } from "next/server";
import { runAnnouncementsImport } from "@/lib/discord-import";

export async function POST() {
  const result = await runAnnouncementsImport();
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ imported: result.imported, message: result.message });
}
