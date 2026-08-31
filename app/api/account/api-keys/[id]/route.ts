import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// DELETE - revoke a key (soft delete via revoked_at, matching this repo's
// other revoke/soft-delete patterns). Scoped to the caller's own user_id in
// the query itself, not just RLS, so a mismatched id 404s instead of 403ing.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Failed to revoke key." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Key not found." }, { status: 404 });

  return NextResponse.json({ revoked: true });
}
