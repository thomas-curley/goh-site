import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSectionVisible } from "@/lib/clan-access";
import { SITE_SECTIONS } from "@/lib/site-sections";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - public: every registered section key the *current viewer* (resolved
// server-side from their own session, same role resolution isSectionVisible
// uses elsewhere) is NOT allowed to see -- for the Navbar to hide the right
// links. No sensitive data here, just which nav items should render.
export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ hiddenKeys: [] });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  const results = await Promise.all(
    SITE_SECTIONS.map(async (section) => ({
      key: section.key,
      visible: await isSectionVisible(supabase, section.key, user?.id ?? null),
    }))
  );

  const hiddenKeys = results.filter((r) => !r.visible).map((r) => r.key);
  return NextResponse.json({ hiddenKeys });
}
