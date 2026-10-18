import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Settings for the bot's /create-room temporary voice rooms (voice_room_settings). */
export interface VoiceRoomSettings {
  enabled: boolean;
  categoryId: string | null;
  nameTemplate: string;
  defaultMaxPeople: number;
  maxRoomSize: number;
  creatorRoleIds: string[];
  staffRoleIds: string[];
  roomsPerPerson: number;
  cleanupMinutes: number;
  deleteWhenEmpty: boolean;
  emptyGraceMinutes: number;
  logChannelId: string | null;
  updatedAt: string | null;
}

export const DEFAULT_VOICE_ROOM_SETTINGS: VoiceRoomSettings = {
  enabled: true,
  categoryId: null,
  nameTemplate: "🔇 {name}'s room",
  defaultMaxPeople: 10,
  maxRoomSize: 99,
  creatorRoleIds: [],
  staffRoleIds: [],
  roomsPerPerson: 1,
  cleanupMinutes: 30,
  deleteWhenEmpty: false,
  emptyGraceMinutes: 5,
  logChannelId: null,
  updatedAt: null,
};

const SNOWFLAKE = /^\d{5,25}$/;

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback;
}

function snowflake(v: unknown): string | null {
  return typeof v === "string" && SNOWFLAKE.test(v.trim()) ? v.trim() : null;
}

function snowflakes(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.map(snowflake).filter((s): s is string => !!s))].slice(0, 50) : [];
}

/** Cleans settings from the admin form; anything invalid falls back to the default. */
export function sanitizeVoiceRoomSettings(v: Record<string, unknown>): Omit<VoiceRoomSettings, "updatedAt"> {
  const d = DEFAULT_VOICE_ROOM_SETTINGS;
  const maxRoomSize = int(v.maxRoomSize, 1, 99, d.maxRoomSize);
  const template = typeof v.nameTemplate === "string" ? v.nameTemplate.trim().slice(0, 90) : "";
  return {
    enabled: v.enabled !== false,
    categoryId: snowflake(v.categoryId),
    nameTemplate: template || d.nameTemplate,
    defaultMaxPeople: Math.min(int(v.defaultMaxPeople, 1, 99, d.defaultMaxPeople), maxRoomSize),
    maxRoomSize,
    creatorRoleIds: snowflakes(v.creatorRoleIds),
    staffRoleIds: snowflakes(v.staffRoleIds),
    roomsPerPerson: int(v.roomsPerPerson, 1, 10, d.roomsPerPerson),
    cleanupMinutes: int(v.cleanupMinutes, 5, 1440, d.cleanupMinutes),
    deleteWhenEmpty: v.deleteWhenEmpty === true,
    emptyGraceMinutes: int(v.emptyGraceMinutes, 0, 120, d.emptyGraceMinutes),
    logChannelId: snowflake(v.logChannelId),
  };
}

export async function getVoiceRoomSettings(supabase: SupabaseClient): Promise<VoiceRoomSettings> {
  const { data } = await supabase.from("voice_room_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_VOICE_ROOM_SETTINGS;
  return {
    enabled: data.enabled,
    categoryId: data.category_id,
    nameTemplate: data.name_template,
    defaultMaxPeople: data.default_max_people,
    maxRoomSize: data.max_room_size,
    creatorRoleIds: data.creator_role_ids ?? [],
    staffRoleIds: data.staff_role_ids ?? [],
    roomsPerPerson: data.rooms_per_person,
    cleanupMinutes: data.cleanup_minutes,
    deleteWhenEmpty: data.delete_when_empty,
    emptyGraceMinutes: data.empty_grace_minutes,
    logChannelId: data.log_channel_id,
    updatedAt: data.updated_at,
  };
}

export async function saveVoiceRoomSettings(supabase: SupabaseClient, s: Omit<VoiceRoomSettings, "updatedAt">, userId: string | null) {
  return supabase.from("voice_room_settings").upsert({
    id: 1,
    enabled: s.enabled,
    category_id: s.categoryId,
    name_template: s.nameTemplate,
    default_max_people: s.defaultMaxPeople,
    max_room_size: s.maxRoomSize,
    creator_role_ids: s.creatorRoleIds,
    staff_role_ids: s.staffRoleIds,
    rooms_per_person: s.roomsPerPerson,
    cleanup_minutes: s.cleanupMinutes,
    delete_when_empty: s.deleteWhenEmpty,
    empty_grace_minutes: s.emptyGraceMinutes,
    log_channel_id: s.logChannelId,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
}
