import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { reconcileRenamedRsns } from "@/lib/rsn-reconciliation";

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

  const user = data.user;
  const meta = user.user_metadata ?? {};

  const discordId = meta.provider_id ?? meta.sub ?? "";
  const discordUsername = meta.full_name ?? meta.name ?? meta.preferred_username ?? "Unknown";
  const discordAvatar = meta.avatar_url ?? meta.picture ?? null;

  // Fetch guild nickname from Discord API
  let discordNickname: string | null = null;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (botToken && guildId && discordId) {
    try {
      const memberRes = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );
      if (memberRes.ok) {
        const member = await memberRes.json();
        discordNickname = member.nick ?? null;
      }
    } catch (err) {
      console.error("Failed to fetch Discord nickname:", err);
    }
  }

  // Upsert user profile
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && discordId) {
    try {
      const serviceClient = createClient(supabaseUrl, serviceKey);

      const { data: profile, error: upsertError } = await serviceClient
        .from("user_profiles")
        .upsert(
          {
            id: user.id,
            discord_id: discordId,
            discord_username: discordUsername,
            discord_avatar: discordAvatar,
            discord_nickname: discordNickname,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select("rsn, onboarding_skipped")
        .single();

      if (upsertError) {
        console.error("Profile upsert failed:", upsertError);
      } else if (profile && !profile.rsn && !profile.onboarding_skipped) {
        // First login (or never answered the prompt) -- route through
        // onboarding before their original destination. The auth cookies
        // already queued on `response` via setAll are preserved since we're
        // only swapping the Location header, not building a new response.
        response.headers.set("location", `${origin}/onboarding?redirect=${encodeURIComponent(redirect)}`);
      } else if (profile?.rsn) {
        // Already linked -- opportunistically fix up their RSN (and any
        // alts) if they renamed in-game since last login, so an in-game
        // name change doesn't silently read as having left the clan. See
        // lib/rsn-reconciliation.ts; best-effort and never throws.
        await reconcileRenamedRsns(serviceClient, user.id);
      }
    } catch (err) {
      console.error("Profile creation error:", err);
    }
  }

  return response;
}
