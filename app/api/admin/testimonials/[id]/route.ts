import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// PATCH - approve/reject (with notes) and/or toggle "featured", independently
// -- a body can contain either or both, only the fields present are touched.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed, user } = await checkPermission("manage_testimonials");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status === "approved" || body.status === "rejected") {
    update.status = body.status;
    update.review_notes = typeof body.reviewNotes === "string" ? body.reviewNotes.trim().slice(0, 1000) || null : null;
    update.reviewed_by = user?.discord_username ?? null;
    update.reviewed_at = new Date().toISOString();
    // A rejected testimonial can't stay featured.
    if (body.status === "rejected") update.featured = false;
  }

  if (typeof body.featured === "boolean") {
    update.featured = body.featured;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase.from("testimonials").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update testimonial." }, { status: 500 });

  return NextResponse.json({ updated: true });
}

// DELETE - remove a testimonial entirely (spam/abuse cleanup).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_testimonials");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await supabase.from("testimonials").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete testimonial." }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
