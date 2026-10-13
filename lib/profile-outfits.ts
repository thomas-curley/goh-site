import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeOutfit, type Outfit } from "@/lib/profiles-format";

export async function getDefaultOutfit(supabase: SupabaseClient): Promise<Outfit> {
  const { data } = await supabase.from("profile_settings").select("value").eq("key", "default_outfit").maybeSingle();
  return sanitizeOutfit(data?.value);
}

export async function saveDefaultOutfit(supabase: SupabaseClient, outfit: Outfit) {
  return supabase
    .from("profile_settings")
    .upsert({ key: "default_outfit", value: outfit, updated_at: new Date().toISOString() });
}

export async function getUserOutfit(supabase: SupabaseClient, userId: string): Promise<Outfit> {
  const { data } = await supabase.from("profile_outfits").select("items").eq("user_id", userId).maybeSingle();
  return sanitizeOutfit(data?.items);
}

/** The member's own items, with any empty slot filled from the clan default. */
export function mergeOutfit(own: Outfit, fallback: Outfit): { outfit: Outfit; usesDefault: boolean } {
  const outfit: Outfit = { ...fallback, ...own };
  return { outfit, usesDefault: Object.keys(own).length === 0 };
}
