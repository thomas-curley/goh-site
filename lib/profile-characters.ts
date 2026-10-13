import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultLook, sanitizeGear, sanitizeLook, type Character, type CharacterGear, type CharacterLook } from "@/lib/osrs-character";

/** The clan default character (the gnome fashionscape), for anything a member hasn't set. */
export async function getDefaultCharacter(supabase: SupabaseClient): Promise<Character> {
  const { data } = await supabase.from("profile_settings").select("value").eq("key", "default_character").maybeSingle();
  const value = (data?.value ?? {}) as { look?: unknown; gear?: unknown };
  return { look: sanitizeLook(value.look) ?? defaultLook(), gear: sanitizeGear(value.gear) };
}

export async function saveDefaultCharacter(supabase: SupabaseClient, character: Character) {
  return supabase
    .from("profile_settings")
    .upsert({ key: "default_character", value: character, updated_at: new Date().toISOString() });
}

/** A member's own choices: their look (null until they set one) and gear. */
export interface OwnCharacter {
  look: CharacterLook | null;
  gear: CharacterGear;
}

export async function getUserCharacter(supabase: SupabaseClient, userId: string): Promise<OwnCharacter> {
  const { data } = await supabase.from("profile_outfits").select("items, look").eq("user_id", userId).maybeSingle();
  return { look: sanitizeLook(data?.look), gear: sanitizeGear(data?.items) };
}

export async function saveUserCharacter(supabase: SupabaseClient, userId: string, own: OwnCharacter) {
  return supabase
    .from("profile_outfits")
    .upsert({ user_id: userId, items: own.gear, look: own.look, updated_at: new Date().toISOString() });
}

/** The member's own look and gear, with anything unset taken from the clan default. */
export function mergeCharacter(own: OwnCharacter, fallback: Character): { character: Character; usesDefault: boolean } {
  return {
    character: { look: own.look ?? fallback.look, gear: { ...fallback.gear, ...own.gear } },
    usesDefault: !own.look && Object.keys(own.gear).length === 0,
  };
}
