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

// Temporary "stage-style" voice rooms made with /create-room. Everyone who
// joins is muted except the room's creator, staff, and anyone the creator or
// staff let speak. The bot keeps no database for them:
// - every voice channel in the temp-rooms category is a temp room;
// - the creator is the member whose overwrite allows Priority Speaker;
// - people allowed to speak have an overwrite that allows Speak.
// So rooms survive a bot restart, and the cleanup can find them again.

/** How often empty rooms are removed. */
export const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
/** A brand-new room isn't removed for being empty until it's this old. */
const MIN_AGE_MS = 5 * 60 * 1000;
export const MAX_ROOM_SIZE = 99;

const CATEGORY_NAME = process.env.TEMP_ROOMS_CATEGORY_NAME || "Temp Rooms";

/** Discord roles counted as staff (Oak and up, as on the website); override with TEMP_ROOM_STAFF_ROLES. */
const STAFF_ROLE_NAMES = (process.env.TEMP_ROOM_STAFF_ROLES || "Oak,Pine,Yew,Council Member,Owner")
  .split(",")
  .map((r) => r.trim().toLowerCase())
  .filter(Boolean);

export function isStaff(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return true;
  }
  return member.roles.cache.some((r) => STAFF_ROLE_NAMES.includes(r.name.toLowerCase()));
}

function staffRoleIds(guild: Guild): string[] {
  return guild.roles.cache.filter((r) => STAFF_ROLE_NAMES.includes(r.name.toLowerCase())).map((r) => r.id);
}

/** The category temp rooms live in: TEMP_ROOMS_CATEGORY_ID, else one named "Temp Rooms" (created if missing). */
export async function getRoomsCategory(guild: Guild): Promise<CategoryChannel> {
  const configuredId = process.env.TEMP_ROOMS_CATEGORY_ID;
  if (configuredId) {
    const configured = await guild.channels.fetch(configuredId).catch(() => null);
    if (configured?.type === ChannelType.GuildCategory) return configured;
  }
  const existing = guild.channels.cache.find(
    (c): c is CategoryChannel => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === CATEGORY_NAME.toLowerCase(),
  );
  if (existing) return existing;
  return guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory, reason: "Category for /create-room rooms" });
}

/** Voice channels in the temp-rooms category (without creating the category). */
export function listRooms(guild: Guild): VoiceChannel[] {
  const configuredId = process.env.TEMP_ROOMS_CATEGORY_ID;
  return [
    ...guild.channels.cache
      .filter(
        (c): c is VoiceChannel =>
          c.type === ChannelType.GuildVoice &&
          !!c.parent &&
          (configuredId ? c.parentId === configuredId : c.parent.name.toLowerCase() === CATEGORY_NAME.toLowerCase()),
      )
      .values(),
  ];
}

export function isTempRoom(channel: VoiceChannel): boolean {
  return listRooms(channel.guild).some((r) => r.id === channel.id);
}

export function roomOwnerId(channel: VoiceChannel): string | null {
  const owner = channel.permissionOverwrites.cache.find(
    (o) => o.type === OverwriteType.Member && o.allow.has(PermissionFlagsBits.PrioritySpeaker) && o.id !== channel.client.user.id,
  );
  return owner?.id ?? null;
}

/** Can this member run the room: its creator, or staff. */
export function canManageRoom(channel: VoiceChannel, member: GuildMember): boolean {
  return roomOwnerId(channel) === member.id || isStaff(member);
}

/** The room this member owns right now, if any (one per person). */
export function ownedRoom(guild: Guild, memberId: string): VoiceChannel | null {
  return listRooms(guild).find((r) => roomOwnerId(r) === memberId) ?? null;
}

export async function createRoom(owner: GuildMember, maxPeople: number, name: string | null): Promise<VoiceChannel> {
  const guild = owner.guild;
  const category = await getRoomsCategory(guild);
  const botId = guild.client.user.id;
  return guild.channels.create({
    name: (name?.trim() || `🔇 ${owner.displayName}'s room`).slice(0, 100),
    type: ChannelType.GuildVoice,
    parent: category,
    userLimit: maxPeople,
    reason: `/create-room by ${owner.user.tag}`,
    permissionOverwrites: [
      // Everyone joins muted.
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Speak] },
      // Staff can always speak.
      ...staffRoleIds(guild).map((id) => ({ id, allow: [PermissionFlagsBits.Speak] })),
      // The creator speaks and is marked as the room's owner.
      { id: owner.id, allow: [PermissionFlagsBits.Speak, PermissionFlagsBits.PrioritySpeaker, PermissionFlagsBits.Connect] },
      // The bot keeps the access it needs to manage and clean up the room.
      {
        id: botId,
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

/** Let a member speak in the room (they stay allowed until revoked or the room closes). */
export async function allowSpeaking(channel: VoiceChannel, member: GuildMember) {
  await channel.permissionOverwrites.edit(member.id, { Speak: true }, { reason: "Allowed to speak in temp room" });
  await refreshVoice(channel, member);
}

/** Put a member back to muted. */
export async function revokeSpeaking(channel: VoiceChannel, member: GuildMember) {
  await channel.permissionOverwrites.delete(member.id, "No longer allowed to speak in temp room");
  await refreshVoice(channel, member);
}

/**
 * Discord applies a Speak change to someone already in the channel when
 * they reconnect, so move them back into the same room to apply it now.
 */
async function refreshVoice(channel: VoiceChannel, member: GuildMember) {
  if (member.voice.channelId !== channel.id) return;
  await member.voice.setChannel(channel, "Apply new speaking permission").catch(() => undefined);
}

/** Deletes temp rooms that are empty (and at least a few minutes old). Returns how many went. */
export async function cleanupRooms(client: Client): Promise<number> {
  let removed = 0;
  for (const guild of client.guilds.cache.values()) {
    for (const room of listRooms(guild)) {
      if (room.members.size > 0) continue;
      if (Date.now() - room.createdTimestamp < MIN_AGE_MS) continue;
      await room
        .delete("Temp room empty at cleanup")
        .then(() => removed++)
        .catch((err) => console.error(`Couldn't delete temp room ${room.name}:`, err));
    }
  }
  return removed;
}

export function startRoomCleanup(client: Client) {
  const run = () =>
    cleanupRooms(client)
      .then((n) => n && console.log(`🧹 Removed ${n} empty temp room(s)`))
      .catch((err) => console.error("Temp room cleanup failed:", err));
  void run();
  setInterval(run, CLEANUP_INTERVAL_MS);
}
