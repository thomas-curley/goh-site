import { EmbedBuilder } from "discord.js";

const CLAN_COLOR = 0x2D5016; // gnome-green
const CLAN_NAME = "Gn0me Home";

export function clanEmbed() {
  return new EmbedBuilder()
    .setColor(CLAN_COLOR)
    .setFooter({ text: CLAN_NAME });
}

export function errorEmbed(message: string) {
  return new EmbedBuilder()
    .setColor(0x8B1A1A) // red-accent
    .setDescription(`❌ ${message}`);
}

export function successEmbed(message: string) {
  return new EmbedBuilder()
    .setColor(CLAN_COLOR)
    .setDescription(`✅ ${message}`);
}
