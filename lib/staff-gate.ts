import "server-only";
import { createClient } from "@supabase/supabase-js";
import { checkClanEligibility, type EligibilityResult } from "@/lib/clan-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** Whether the current visitor is Staff rank (Oak and above), with a reason when not. */
export async function checkStaffViewer(context: string): Promise<EligibilityResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { eligible: true };
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  return checkClanEligibility(createClient(url, key), "staff", user?.id ?? null, context);
}
