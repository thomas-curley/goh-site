import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getHiddenSectionKeys } from "@/lib/clan-access";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - public: every registered section key the *current viewer* (resolved
// server-side from their own session, same role resolution isSectionVisible
// uses elsewhere) is NOT allowed to see -- the Navbar's ongoing freshness
// check after its first paint, which is now seeded server-side (see
// app/layout.tsx) from this same getHiddenSectionKeys so there's no flash of
// a hidden link rendering before this client-side check catches up to hide
// it moments later. No sensitive data here, just which nav items should
// render.
export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ hiddenKeys: [] });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const hiddenKeys = await getHiddenSectionKeys(supabase, user?.id ?? null);

  return NextResponse.json({ hiddenKeys });
}
