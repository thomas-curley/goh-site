import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getLinkedRsn } from "../lib/api.js";
import { getPlayer, getCombatLevel } from "../lib/wom.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lfg")
    .setDescription("Post a looking-for-group request")
    .addStringOption((opt) =>
      opt.setName("activity").setDescription("Boss or activity (e.g. CoX, ToB, Bandos)").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("world").setDescription("World number").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("spots").setDescription("Number of spots available").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("requirements").setDescription("Gear/stat requirements").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const activity = interaction.options.getString("activity", true);
    const world = interaction.options.getInteger("world", true);
    const spots = interaction.options.getInteger("spots", true);
    const requirements = interaction.options.getString("requirements");

    const rsn = await getLinkedRsn(interaction.user.id);

    const embed = clanEmbed()
      .setTitle(`⚔️ LFG: ${activity}`)
      .addFields(
        { name: "World", value: String(world), inline: true },
        { name: "Spots", value: String(spots), inline: true },
        { name: "Host", value: rsn ?? interaction.user.displayName, inline: true },
      );

    if (requirements) {
      embed.addFields({ name: "Requirements", value: requirements });
    }

    // Add player stats if linked
    if (rsn) {
      const player = await getPlayer(rsn);
      if (player) {
        const combat = player.combatLevel ?? getCombatLevel(player.latestSnapshot ?? {});
        const total = player.latestSnapshot?.data?.skills?.overall?.level ?? 0;
        embed.addFields({
          name: "Host Stats",
          value: `Combat: **${combat}** | Total: **${total}**`,
        });
      }
    }

    embed.setFooter({ text: "Reply or whisper in-game to join • Gn0me Home" });

    await interaction.editReply({ embeds: [embed] });
  },
};
