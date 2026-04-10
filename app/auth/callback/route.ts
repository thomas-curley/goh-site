import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/account";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/login?error=supabase_not_configured`);
  }

  const response = NextResponse.redirect(`${origin}${redirect}`);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Upsert user profile with Discord info from the OAuth provider
  const user = data.user;
  const discordMeta = user.user_metadata;

  const profile = {
    id: user.id,
    discord_id: discordMeta?.provider_id ?? discordMeta?.sub ?? "",
    discord_username: discordMeta?.full_name ?? discordMeta?.name ?? discordMeta?.preferred_username ?? "Unknown",
    discord_avatar: discordMeta?.avatar_url ?? null,
    updated_at: new Date().toISOString(),
  };

  // Use service role to bypass RLS for the upsert
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceKey);

    await serviceClient.from("user_profiles").upsert(profile, {
      onConflict: "id",
    });
  }

  return response;
}
