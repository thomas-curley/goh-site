import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getLinkedRsn } from "../lib/api.js";
import { getPlayer, formatNumber, getCombatLevel } from "../lib/wom.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("signup")
    .setDescription("Sign up for an event")
    .addStringOption((opt) =>
      opt.setName("event").setDescription("Event name").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("notes").setDescription("Any notes (role, gear, etc.)").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const eventName = interaction.options.getString("event", true);
    const notes = interaction.options.getString("notes");

    const rsn = await getLinkedRsn(interaction.user.id);

    const embed = clanEmbed()
      .setTitle(`📋 Event Signup: ${eventName}`)
      .addFields(
        { name: "Player", value: rsn ?? interaction.user.displayName, inline: true },
      );

    if (notes) {
      embed.addFields({ name: "Notes", value: notes });
    }

    // Add stats if linked
    if (rsn) {
      const player = await getPlayer(rsn);
      if (player) {
        const combat = player.combatLevel ?? getCombatLevel(player.latestSnapshot ?? {});
        const total = player.latestSnapshot?.data?.skills?.overall?.level ?? 0;

        // Top 3 bosses
        const bosses = player.latestSnapshot?.data?.bosses ?? {};
        const topBosses = Object.entries(bosses)
          .filter(([, d]) => (d as { kills: number }).kills > 0)
          .sort(([, a], [, b]) => (b as { kills: number }).kills - (a as { kills: number }).kills)
          .slice(0, 3)
          .map(([name, d]) => {
            const displayName = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            return `${displayName}: ${formatNumber((d as { kills: number }).kills)}`;
          });

        embed.addFields(
          { name: "Combat", value: String(combat), inline: true },
          { name: "Total", value: String(total), inline: true },
        );

        if (topBosses.length > 0) {
          embed.addFields({ name: "Top Bosses", value: topBosses.join(" | ") });
        }
      }
    }

    embed.setFooter({ text: "Host will confirm your spot • Gn0me Home" });

    await interaction.editReply({ embeds: [embed] });
  },
};
