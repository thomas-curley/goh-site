import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getPlayer } from "../lib/wom.js";
import { successEmbed, errorEmbed } from "../lib/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to your OSRS username")
    .addStringOption((opt) =>
      opt.setName("rsn").setDescription("Your OSRS username").setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const rsn = interaction.options.getString("rsn", true);
    await interaction.deferReply({ ephemeral: true });

    // Verify on WOM
    const player = await getPlayer(rsn);
    if (!player) {
      await interaction.editReply({
        embeds: [errorEmbed(`Player "${rsn}" not found on Wise Old Man. Make sure you've been tracked.`)],
      });
      return;
    }

    // Direct user to the website to link
    await interaction.editReply({
      embeds: [
        successEmbed(
          `Player **${player.displayName}** found on WOM!\n\n` +
          `To link your RSN, visit the website:\n` +
          `🔗 **${process.env.NEXT_PUBLIC_SITE_URL ?? "https://gn0mehome.com"}/account**\n\n` +
          `Log in with Discord and enter your RSN there. This ensures secure linking with duplicate protection.`
        ),
      ],
    });
  },
};
