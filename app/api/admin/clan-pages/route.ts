import { NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { getServiceClient } from "@/lib/newsletter-admin";

// GET - both clan pages' current uploads.
export async function GET() {
  const { allowed } = await checkPermission("manage_clan_pages");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("clan_pages").select("*");
  if (error) return NextResponse.json({ error: "Failed to load the pages." }, { status: 500 });
  return NextResponse.json({ pages: data ?? [] });
}
