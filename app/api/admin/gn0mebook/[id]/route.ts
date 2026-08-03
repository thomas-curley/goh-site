import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// PATCH - toggle whether a profile is hidden by an admin. The only field
// this route (or any admin) can touch -- everything else about a profile
// stays under its owner's control.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_member_profiles");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "Missing 'hidden' boolean." }, { status: 400 });
  }

  const { error } = await supabase
    .from("member_profiles")
    .update({ hidden_by_admin: body.hidden, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });

  return NextResponse.json({ updated: true });
}
