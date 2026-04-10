/**
 * Discord API helpers for bidirectional event sync.
 * Requires DISCORD_BOT_TOKEN and DISCORD_GUILD_ID env vars.
 */

const DISCORD_API = "https://discord.com/api/v10";

function getHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN not set");
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

interface DiscordScheduledEvent {
  name: string;
  description?: string;
  scheduled_start_time: string;
  scheduled_end_time?: string;
  entity_type: 3; // External
  entity_metadata?: { location?: string };
  privacy_level: 2; // Guild only
}

export async function createDiscordEvent(event: DiscordScheduledEvent) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error("DISCORD_GUILD_ID not set");

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/scheduled-events`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Discord API error: ${res.status} ${error}`);
  }

  return res.json();
}

export async function updateDiscordEvent(eventId: string, updates: Partial<DiscordScheduledEvent>) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error("DISCORD_GUILD_ID not set");

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/scheduled-events/${eventId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Discord API error: ${res.status} ${error}`);
  }

  return res.json();
}

export async function deleteDiscordEvent(eventId: string) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error("DISCORD_GUILD_ID not set");

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/scheduled-events/${eventId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok && res.status !== 204) {
    const error = await res.text();
    throw new Error(`Discord API error: ${res.status} ${error}`);
  }
}

/**
 * Post a message to a Discord channel.
 */
export async function postToChannel(channelId: string, content: string) {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Discord API error: ${res.status} ${error}`);
  }

  return res.json();
}

/**
 * Create a thread in a channel (for sign-ups).
 * Posts an initial message then creates a public thread from it.
 */
export async function createSignupThread(
  channelId: string,
  eventTitle: string,
  initialMessage: string
): Promise<{ threadId: string; messageId: string }> {
  // Post the initial message
  const msg = await postToChannel(channelId, initialMessage);

  // Create a public thread from that message
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${msg.id}/threads`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      name: `Sign-ups: ${eventTitle}`.slice(0, 100),
      auto_archive_duration: 10080, // 7 days
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Discord API error creating thread: ${res.status} ${error}`);
  }

  const thread = await res.json();
  return { threadId: thread.id, messageId: msg.id };
}

export async function getDiscordEvents() {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error("DISCORD_GUILD_ID not set");

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/scheduled-events`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Discord API error: ${res.status} ${error}`);
  }

  return res.json();
}
