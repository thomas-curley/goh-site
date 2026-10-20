import { Events, type Client, type Message, type PartialMessage } from "discord.js";

/**
 * Clan feed: forwards posts in the channels picked on the site (Admin ›
 * Clan Feed) to the site, which reads drops and quest completions out of
 * them for bingo and quest events. Only posts by bots and webhooks
 * (DropTracker, clan-chat forwarders) are sent, never what members type.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SECRET = process.env.DISCORD_WEBHOOK_SECRET ?? "";
const REFRESH_MS = 5 * 60 * 1000;

let channelIds = new Set<string>();

async function call(path: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}`, ...init.headers } });
}

async function refreshChannels() {
  try {
    const res = await call("/api/bot/feed");
    if (!res.ok) return;
    const json = (await res.json()) as { channelIds?: string[] };
    channelIds = new Set(json.channelIds ?? []);
  } catch {
    // keep the last list
  }
}

async function forward(message: Message | PartialMessage, client: Client) {
  if (!channelIds.has(message.channelId)) return;
  if (message.partial) {
    try {
      message = await message.fetch();
    } catch {
      return;
    }
  }
  const msg = message as Message;
  if (msg.author?.id === client.user?.id) return;
  if (!msg.webhookId && !msg.author?.bot) return;
  if (!msg.content && msg.embeds.length === 0) return;

  const payload = {
    messageId: msg.id,
    channelId: msg.channelId,
    authorName: msg.author?.username ?? null,
    postedAt: new Date(msg.createdTimestamp).toISOString(),
    content: msg.content,
    embeds: msg.embeds.map((e) => ({
      authorName: e.author?.name ?? null,
      title: e.title,
      description: e.description,
      fields: e.fields.map((f) => ({ name: f.name, value: f.value })),
      footer: e.footer?.text ?? null,
      imageUrl: e.image?.url ?? null,
      thumbnailUrl: e.thumbnail?.url ?? null,
    })),
    attachmentUrls: [...msg.attachments.values()].filter((a) => a.contentType?.startsWith("image/")).map((a) => a.url),
  };
  try {
    await call("/api/bot/feed", { method: "POST", body: JSON.stringify(payload) });
  } catch (err) {
    console.error("Clan feed forward failed:", err);
  }
}

export function startClanFeed(client: Client) {
  refreshChannels();
  setInterval(refreshChannels, REFRESH_MS);
  client.on(Events.MessageCreate, (m) => void forward(m, client));
  // Some bots post first and fill the embed in with an edit.
  client.on(Events.MessageUpdate, (_old, m) => void forward(m, client));
}
