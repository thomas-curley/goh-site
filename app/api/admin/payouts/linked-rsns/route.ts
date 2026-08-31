import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - every RSN with a verified linked account -- lets the Add Winners
// form show a live "will notify" indicator as an admin types, using the
// exact same set resolvePayoutRecipient() matches against server-side.
export async function GET() {
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ rsns: [] });

  const { data } = await supabase.from("user_profiles").select("rsn").eq("rsn_verified", true).not("rsn", "is", null);

  return NextResponse.json({ rsns: (data ?? []).map((p) => p.rsn as string) });
}
