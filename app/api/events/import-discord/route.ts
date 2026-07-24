import { NextResponse } from "next/server";
import { runEventsImport } from "@/lib/discord-import";

export async function POST() {
  const result = await runEventsImport();
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ imported: result.imported, message: result.message });
}
