import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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
    console.error("Auth exchange failed:", error);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Upsert user profile with Discord info from the OAuth provider
  const user = data.user;
  const meta = user.user_metadata ?? {};

  // Discord provider_id can be in different fields depending on Supabase version
  const discordId = meta.provider_id ?? meta.sub ?? meta.custom_claims?.global_name ?? "";
  const discordUsername = meta.full_name ?? meta.name ?? meta.preferred_username ?? meta.custom_claims?.global_name ?? "Unknown";
  const discordAvatar = meta.avatar_url ?? meta.picture ?? null;

  // Use service role to bypass RLS for the upsert
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && discordId) {
    try {
      const serviceClient = createClient(supabaseUrl, serviceKey);

      const { error: upsertError } = await serviceClient
        .from("user_profiles")
        .upsert(
          {
            id: user.id,
            discord_id: discordId,
            discord_username: discordUsername,
            discord_avatar: discordAvatar,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (upsertError) {
        console.error("Profile upsert failed:", upsertError);
      }
    } catch (err) {
      console.error("Profile creation error:", err);
    }
  } else {
    console.error("Cannot create profile — missing service key or discord_id", {
      hasServiceKey: !!serviceKey,
      discordId,
      metaKeys: Object.keys(meta),
    });
  }

  return response;
}
