import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSectionVisible } from "@/lib/clan-access";
import type { SiteSectionKey } from "@/lib/site-sections";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * One-line gate for a public page's server component: resolves the current
 * viewer (or lack thereof) and checks it against the section-visibility grid
 * an admin configures at /admin/sections. Returns true (visible) when
 * Supabase isn't configured -- dev mode, matching how other gates in this
 * app degrade -- rather than locking every page in local development.
 */
export async function checkSectionAccess(key: SiteSectionKey): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) return true;

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  return isSectionVisible(supabase, key, user?.id ?? null);
}
