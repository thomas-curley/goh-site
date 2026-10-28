import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { reconcileRenamedRsns } from "@/lib/rsn-reconciliation";

/**
 * Sends a failed login back to /login with a reason the page explains and
 * the exact error text, so anything we haven't planned for still shows up
 * on screen (and in the logs) instead of looking like a silent loop.
 */
function fail(origin: string, redirect: string, reason: string, detail?: string | null) {
  console.error(`Login failed (${reason}):`, detail ?? "(no details)");
  const qs = new URLSearchParams({ error: reason, redirect });
  if (detail) qs.set("detail", detail.replace(/\s+/g, " ").trim().slice(0, 300));
  return NextResponse.redirect(`${origin}/login?${qs}`);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const redirect = searchParams.get("redirect") ?? "/account";
  try {
    return await finishLogin(request, searchParams, origin, redirect);
  } catch (err) {
    return fail(origin, redirect, "unexpected", err instanceof Error ? err.message : String(err));
  }
}

async function finishLogin(request: NextRequest, searchParams: URLSearchParams, origin: string, redirect: string) {
  const code = searchParams.get("code");

  if (!code) {
    // Supabase (or Discord) sent the person back without a code, with the
    // reason in error / error_code / error_description.
    const providerError = searchParams.get("error");
    const errorCode = searchParams.get("error_code");
    const description = searchParams.get("error_description");
    const detail = [description, errorCode && `(${errorCode})`, !description && providerError].filter(Boolean).join(" ") || null;
    const text = `${description ?? ""} ${providerError ?? ""} ${errorCode ?? ""}`.toLowerCase();
    const reason = text.includes("email")
      ? "no_email"
      : text.includes("access_denied") || text.includes("denied") || text.includes("cancel")
        ? "access_denied"
        : detail
          ? "provider_error"
          : "no_code";
    return fail(origin, redirect, reason, detail);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return fail(origin, redirect, "not_configured", "The site's login service isn't configured.");
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
    const detail = error ? [error.message, error.code && `(${error.code})`].filter(Boolean).join(" ") : "Supabase returned no user.";
    return fail(origin, redirect, "auth_failed", detail);
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
