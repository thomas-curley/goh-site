import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPluginToken } from "@/lib/plugin-auth";
import { hasPermission } from "@/lib/permissions";
import { PLUGIN_THEMES, getPluginBranding, type PluginTheme } from "@/lib/plugin-settings";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_NAME_LENGTH = 40;

/**
 * POST /api/plugin/admin/settings -- the clan owner's one-time (or any-time)
 * plugin setup, done from inside the plugin: clan name and colour theme
 * that every member's plugin then renders with. Gated by
 * manage_plugin_settings (seeded for the owner rank; grantable to others
 * from /admin/permissions like any other permission).
 */
export async function POST(request: NextRequest) {
  const identity = await verifyPluginToken(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: perms } = await supabase
    .from("role_permissions")
    .select("role, permission, granted")
    .eq("permission", "manage_plugin_settings");

  if (!hasPermission(perms ?? [], identity.clanRank, "manage_plugin_settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clanName = typeof body.clanName === "string" ? body.clanName.trim().slice(0, MAX_NAME_LENGTH) : "";
  const theme = typeof body.theme === "string" ? body.theme : "";

  if (!clanName) return NextResponse.json({ error: "Enter a clan name." }, { status: 400 });
  if (!(PLUGIN_THEMES as readonly string[]).includes(theme)) {
    return NextResponse.json({ error: `Theme must be one of: ${PLUGIN_THEMES.join(", ")}.` }, { status: 400 });
  }

  const { error } = await supabase
    .from("plugin_settings")
    .update({
      clan_name: clanName,
      theme: theme as PluginTheme,
      configured: true,
      updated_by: identity.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: "Failed to save plugin settings." }, { status: 500 });

  return NextResponse.json({ saved: true, branding: await getPluginBranding(supabase) });
}
