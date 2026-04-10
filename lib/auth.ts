import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";

/**
 * Require an authenticated user. Redirects to /login if not logged in.
 * Call this at the top of any protected server component page.
 */
export async function requireAuth(redirectPath?: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect(`/login?redirect=${encodeURIComponent(redirectPath ?? "/account")}`);
    }

    return { supabase, user };
  } catch (error) {
    // If Supabase isn't configured, the createSupabaseServerClient throws.
    // Re-throw redirect errors (they're special in Next.js)
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    // Check for the redirect digest pattern
    if (typeof error === "object" && error !== null && "digest" in error) throw error;

    // Supabase not configured — return null user for dev mode
    return { supabase: null, user: null };
  }
}
