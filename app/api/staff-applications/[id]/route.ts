import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// PUT - approve or reject an application.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed, user } = await checkPermission("manage_staff_applications");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const status = body.status;
  if (status !== "accepted" && status !== "rejected") {
    return NextResponse.json({ error: "status must be 'accepted' or 'rejected'." }, { status: 400 });
  }

  const reviewNotes = typeof body.review_notes === "string" ? body.review_notes.trim().slice(0, 1000) : null;

  const { error } = await supabase
    .from("staff_applications")
    .update({
      status,
      review_notes: reviewNotes,
      reviewed_by: user?.discord_username ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Failed to update application." }, { status: 500 });

  return NextResponse.json({ updated: true });
}
