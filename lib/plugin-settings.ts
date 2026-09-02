import type { SupabaseClient } from "@supabase/supabase-js";
import { CLAN_NAME } from "./constants";

/**
 * Colour theme sets the companion plugin knows how to render. The palettes
 * themselves live in the plugin (it's the one drawing them); the site only
 * needs the list of valid keys to validate an owner's choice. Keep in sync
 * with the plugin's Theme enum.
 */
export const PLUGIN_THEMES = ["moss", "ember", "tide", "slate"] as const;
export type PluginTheme = (typeof PLUGIN_THEMES)[number];

export interface PluginBranding {
  clanName: string;
  theme: PluginTheme;
  /** False until someone with manage_plugin_settings has saved settings at least once. */
  configured: boolean;
}

/**
 * What every member's plugin should render with. clan_name null (never set
 * up) falls back to the site's own CLAN_NAME so an existing deployment is
 * branded correctly with zero setup -- `configured` still reports false so
 * an owner is prompted to confirm it and pick a theme.
 */
export async function getPluginBranding(supabase: SupabaseClient): Promise<PluginBranding> {
  const { data } = await supabase.from("plugin_settings").select("clan_name, theme, configured").eq("id", 1).maybeSingle();
  const theme = (PLUGIN_THEMES as readonly string[]).includes(data?.theme ?? "") ? (data!.theme as PluginTheme) : "moss";
  return {
    clanName: data?.clan_name?.trim() || CLAN_NAME,
    theme,
    configured: data?.configured ?? false,
  };
}
