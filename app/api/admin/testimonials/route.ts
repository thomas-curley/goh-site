import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const VALID_STATUSES = ["pending", "approved", "rejected"];

// GET - list testimonials, optionally filtered by status.
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_testimonials");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const status = request.nextUrl.searchParams.get("status");
  let query = supabase.from("testimonials").select("*").order("created_at", { ascending: false });
  if (status && VALID_STATUSES.includes(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load testimonials." }, { status: 500 });

  return NextResponse.json({ testimonials: data ?? [] });
}
