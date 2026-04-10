import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Placeholder client for SSR/prerender — fails gracefully on actual API calls
    return createBrowserClient("https://placeholder.supabase.co", "placeholder-key");
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
