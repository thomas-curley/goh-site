import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Client,
  type Guild,
  type GuildMember,
  type VoiceChannel,
} from "discord.js";

// Temporary "stage-style" voice rooms made with /vc. Everyone who
// joins is muted except the room's creator, staff, and anyone the creator or
// staff let speak. Settings come from the website (Admin › Voice Rooms).
//
// The bot keeps no database of rooms. A temp room is a voice channel where
// the bot gave itself a member overwrite (Manage Roles + Move Members) and
// one member, the creator, has an overwrite allowing Priority Speaker.
// People allowed to talk have an overwrite allowing Speak. So rooms survive
// a bot restart and a change of category.

export interface RoomSettings {
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
}

const DEFAULT_CATEGORY_NAME = process.env.TEMP_ROOMS_CATEGORY_NAME || "Temp Rooms";

/** Used when no staff roles are picked on the website: roles with these names (Oak and up, as on the site). */
const FALLBACK_STAFF_ROLE_NAMES = (process.env.TEMP_ROOM_STAFF_ROLES || "Oak,Pine,Yew,Council Member,Owner")
  .split(",")
  .map((r) => r.trim().toLowerCase())
  .filter(Boolean);

const DEFAULTS: RoomSettings = {
  enabled: true,
  categoryId: process.env.TEMP_ROOMS_CATEGORY_ID || null,
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
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SECRET = process.env.DISCORD_WEBHOOK_SECRET ?? "";
const SETTINGS_TTL_MS = 2 * 60 * 1000;
let cached: { settings: RoomSettings; at: number } | null = null;

/** Settings from the website, cached for two minutes; the last good copy (or defaults) if the site can't be reached. */
export async function getRoomSettings(): Promise<RoomSettings> {
  if (cached && Date.now() - cached.at < SETTINGS_TTL_MS) return cached.settings;
  try {
    const res = await fetch(`${SITE_URL}/api/bot/voice-rooms`, { headers: { Authorization: `Bearer ${SECRET}` } });
    if (res.ok) {
      const data = (await res.json()) as { settings?: Partial<RoomSettings> };
      const settings = { ...DEFAULTS, ...data.settings, categoryId: data.settings?.categoryId ?? DEFAULTS.categoryId };
      cached = { settings, at: Date.now() };
      return settings;
    }
    console.error(`Voice room settings: website answered ${res.status}`);
  } catch (err) {
    console.error("Voice room settings: couldn't reach the website", err);
  }
  return cached?.settings ?? DEFAULTS;
}

export function isStaff(member: GuildMember, settings: RoomSettings): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return true;
  }
  if (settings.staffRoleIds.length > 0) return member.roles.cache.some((r) => settings.staffRoleIds.includes(r.id));
  return member.roles.cache.some((r) => FALLBACK_STAFF_ROLE_NAMES.includes(r.name.toLowerCase()));
}

export function canCreateRooms(member: GuildMember, settings: RoomSettings): boolean {
  if (isStaff(member, settings)) return true;
  if (settings.creatorRoleIds.length === 0) return true;
  return member.roles.cache.some((r) => settings.creatorRoleIds.includes(r.id));
}

function staffRoleIds(guild: Guild, settings: RoomSettings): string[] {
  if (settings.staffRoleIds.length > 0) return settings.staffRoleIds.filter((id) => guild.roles.cache.has(id));
  return guild.roles.cache.filter((r) => FALLBACK_STAFF_ROLE_NAMES.includes(r.name.toLowerCase())).map((r) => r.id);
}

/** The category new rooms go in: the one picked on the website, else "Temp Rooms" (created if missing). */
async function getRoomsCategory(guild: Guild, settings: RoomSettings): Promise<CategoryChannel> {
  if (settings.categoryId) {
    const picked = await guild.channels.fetch(settings.categoryId).catch(() => null);
    if (picked?.type === ChannelType.GuildCategory) return picked;
    console.error(`Voice rooms: category ${settings.categoryId} not found, using "${DEFAULT_CATEGORY_NAME}"`);
  }
  const existing = guild.channels.cache.find(
    (c): c is CategoryChannel => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase(),
  );
  if (existing) return existing;
  return guild.channels.create({ name: DEFAULT_CATEGORY_NAME, type: ChannelType.GuildCategory, reason: "Category for /vc rooms" });
}

export function isTempRoom(channel: VoiceChannel): boolean {
  const botOverwrite = channel.permissionOverwrites.cache.get(channel.client.user.id);
  return (
    !!botOverwrite &&
    botOverwrite.allow.has(PermissionFlagsBits.ManageRoles) &&
    botOverwrite.allow.has(PermissionFlagsBits.MoveMembers) &&
    roomOwnerId(channel) !== null
  );
}

/** Every temp room in the server, wherever it is. */
export function listRooms(guild: Guild): VoiceChannel[] {
  return [...guild.channels.cache.filter((c): c is VoiceChannel => c.type === ChannelType.GuildVoice && isTempRoom(c)).values()];
}

export function roomOwnerId(channel: VoiceChannel): string | null {
  const owner = channel.permissionOverwrites.cache.find(
    (o) => o.type === OverwriteType.Member && o.allow.has(PermissionFlagsBits.PrioritySpeaker) && o.id !== channel.client.user.id,
  );
  return owner?.id ?? null;
}

export function canManageRoom(channel: VoiceChannel, member: GuildMember, settings: RoomSettings): boolean {
  return roomOwnerId(channel) === member.id || isStaff(member, settings);
}

export function ownedRooms(guild: Guild, memberId: string): VoiceChannel[] {
  return listRooms(guild).filter((r) => roomOwnerId(r) === memberId);
}

export function isLocked(channel: VoiceChannel): boolean {
  return channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id)?.deny.has(PermissionFlagsBits.Connect) ?? false;
}

/** Members (other than the creator) allowed to speak by name, plus the staff roles. */
export function speakers(channel: VoiceChannel): string[] {
  const owner = roomOwnerId(channel);
  return channel.permissionOverwrites.cache
    .filter(
      (o) => o.type === OverwriteType.Member && o.id !== owner && o.id !== channel.client.user.id && o.allow.has(PermissionFlagsBits.Speak),
    )
    .map((o) => o.id);
}

export async function createRoom(owner: GuildMember, maxPeople: number, name: string | null, settings: RoomSettings): Promise<VoiceChannel> {
  const guild = owner.guild;
  const category = await getRoomsCategory(guild, settings);
  const roomName = (name?.trim() || settings.nameTemplate.replaceAll("{name}", owner.displayName)).slice(0, 100);
  return guild.channels.create({
    name: roomName,
    type: ChannelType.GuildVoice,
    parent: category,
    userLimit: maxPeople,
    reason: `/vc by ${owner.user.tag}`,
    permissionOverwrites: [
      // Everyone joins muted.
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Speak] },
      // Staff can always speak, and join even when the room is locked.
      ...staffRoleIds(guild, settings).map((id) => ({ id, allow: [PermissionFlagsBits.Speak, PermissionFlagsBits.Connect] })),
      // The creator speaks and is marked as the room's owner.
      { id: owner.id, allow: [PermissionFlagsBits.Speak, PermissionFlagsBits.PrioritySpeaker, PermissionFlagsBits.Connect] },
      // The bot keeps the access it needs to manage and clean up the room (and marks it as a temp room).
      {
        id: guild.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageRoles,
          PermissionFlagsBits.MoveMembers,
        ],
      },
    ],
  });
}

/** Let a member speak in the room (and join it while locked). */
export async function allowSpeaking(channel: VoiceChannel, member: GuildMember) {
  await channel.permissionOverwrites.edit(member.id, { Speak: true, Connect: true }, { reason: "Allowed to speak in temp room" });
  await refreshVoice(channel, member);
}

/** Put a member back to muted. */
export async function revokeSpeaking(channel: VoiceChannel, member: GuildMember) {
  await channel.permissionOverwrites.delete(member.id, "No longer allowed to speak in temp room");
  await refreshVoice(channel, member);
}

/** Hand the room to someone else; the old creator can still speak. */
export async function transferRoom(channel: VoiceChannel, to: GuildMember) {
  const from = roomOwnerId(channel);
  await channel.permissionOverwrites.edit(to.id, { Speak: true, PrioritySpeaker: true, Connect: true }, { reason: "Temp room transferred" });
  if (from && from !== to.id) {
    await channel.permissionOverwrites.edit(from, { PrioritySpeaker: null }, { reason: "Temp room transferred" });
  }
  await refreshVoice(channel, to);
}

/** Stop (or allow) new people joining; people already in the room stay. */
export async function setLocked(channel: VoiceChannel, locked: boolean) {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone.id, { Connect: locked ? false : null }, {
    reason: locked ? "Temp room locked" : "Temp room unlocked",
  });
}

/**
 * Discord applies a Speak change to someone already in the channel when
 * they reconnect, so move them back into the same room to apply it now.
 */
async function refreshVoice(channel: VoiceChannel, member: GuildMember) {
  if (member.voice.channelId !== channel.id) return;
  await member.voice.setChannel(channel, "Apply new speaking permission").catch(() => undefined);
}

/** Post a line to the log channel picked on the website, if any. */
export async function logRoom(guild: Guild, message: string) {
  const settings = await getRoomSettings();
  if (!settings.logChannelId) return;
  const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
  if (channel?.isTextBased()) await channel.send({ content: message, allowedMentions: { parse: [] } }).catch(() => undefined);
}

async function deleteIfEmpty(room: VoiceChannel, settings: RoomSettings, reason: string): Promise<boolean> {
  if (room.members.size > 0) return false;
  if (Date.now() - room.createdTimestamp < settings.emptyGraceMinutes * 60 * 1000) return false;
  const name = room.name;
  const deleted = await room
    .delete(reason)
    .then(() => true)
    .catch((err) => {
      console.error(`Couldn't delete temp room ${name}:`, err);
      return false;
    });
  if (deleted) await logRoom(room.guild, `🧹 Removed empty room **${name}**.`);
  return deleted;
}

/** Deletes temp rooms that are empty (and older than the grace period). Returns how many went. */
export async function cleanupRooms(client: Client): Promise<number> {
  const settings = await getRoomSettings();
  let removed = 0;
  for (const guild of client.guilds.cache.values()) {
    for (const room of listRooms(guild)) {
      if (await deleteIfEmpty(room, settings, "Temp room empty at cleanup")) removed++;
    }
  }
  return removed;
}

/** Runs the cleanup at startup and then on the interval set on the website. */
export function startRoomCleanup(client: Client) {
  const run = async () => {
    try {
      const n = await cleanupRooms(client);
      if (n) console.log(`🧹 Removed ${n} empty temp room(s)`);
    } catch (err) {
      console.error("Temp room cleanup failed:", err);
    }
    const { cleanupMinutes } = await getRoomSettings();
    setTimeout(run, Math.max(cleanupMinutes, 5) * 60 * 1000);
  };
  void run();
}

/** If "delete as soon as empty" is on, remove a room when its last person leaves. */
export async function onVoiceLeave(channel: VoiceChannel) {
  if (!isTempRoom(channel) || channel.members.size > 0) return;
  const settings = await getRoomSettings();
  if (settings.deleteWhenEmpty) await deleteIfEmpty(channel, settings, "Temp room emptied");
}
