import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { resolveEffectiveRole, isSectionVisibleForRole } from "@/lib/clan-access";
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
//
// Resolves the viewer's role once (a WOM API call) and reuses it across all
// registered sections, rather than each section independently re-resolving
// it -- this route used to fire one WOM call per section (16, at last
// count) on every page load from both Navbar and UserMenu, which reliably
// tripped WOM's rate limit and broke role resolution for every other
// feature sharing that quota.
export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ hiddenKeys: [] });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const role = await resolveEffectiveRole(supabase, user?.id ?? null);

  const results = await Promise.all(
    SITE_SECTIONS.map(async (section) => ({
      key: section.key,
      visible: await isSectionVisibleForRole(supabase, role, section.key),
    }))
  );

  const hiddenKeys = results.filter((r) => !r.visible).map((r) => r.key);
  return NextResponse.json({ hiddenKeys });
}
