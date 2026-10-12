import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { getServiceClient, parseNewsletterBody } from "@/lib/newsletter-admin";

// GET - every issue, drafts included, newest first.
export async function GET() {
  const { allowed } = await checkPermission("manage_newsletter");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("newsletters").select("*").order("issue_number", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load issues." }, { status: 500 });
  return NextResponse.json({ newsletters: data ?? [] });
}

// POST - create an issue.
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_newsletter");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const parsed = parseNewsletterBody(await request.json().catch(() => ({})), false);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from("newsletters")
    .insert({ ...parsed.update, created_by: user?.discord_username ?? null })
    .select("*")
    .single();
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "That issue number already exists." : "Failed to save the issue." }, { status: duplicate ? 409 : 500 });
  }
  return NextResponse.json({ newsletter: data });
}
