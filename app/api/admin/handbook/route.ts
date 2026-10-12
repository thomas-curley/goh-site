import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { getServiceClient, parseEditionBody, signEdition } from "@/lib/handbook-editions";
import type { HandbookEditionRow } from "@/lib/handbook-format";

// GET - every handbook edition, drafts included, newest first, with signed
// page links for previewing.
export async function GET() {
  const { allowed } = await checkPermission("manage_handbook");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("handbook_editions").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load handbook editions." }, { status: 500 });

  const rows = (data ?? []) as HandbookEditionRow[];
  const editions = await Promise.all(
    rows.map(async (row) => ({ ...(await signEdition(supabase, row)), page_paths: row.page_paths, pdf_path: row.pdf_path }))
  );
  return NextResponse.json({ editions });
}

// POST - create an edition (saved as a draft unless isPublished).
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_handbook");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const parsed = parseEditionBody(await request.json().catch(() => ({})), false);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { update } = parsed;
  if (update.is_published === true) {
    if ((update.page_paths as string[]).length === 0) return NextResponse.json({ error: "Add at least one page before publishing." }, { status: 400 });
    update.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("handbook_editions")
    .insert({ ...update, created_by: user?.discord_username ?? null })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the handbook." }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
