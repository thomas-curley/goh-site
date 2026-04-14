import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getPlayer, formatNumber } from "../lib/wom.js";
import { getLinkedRsn } from "../lib/api.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("kc")
    .setDescription("Show top boss kill counts")
    .addUserOption((opt) =>
      opt.setName("member").setDescription("Discord member to check").setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("rsn").setDescription("OSRS username").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("member") ?? interaction.user;
    let rsn = interaction.options.getString("rsn");

    if (!rsn) {
      rsn = await getLinkedRsn(target.id);
      if (!rsn) {
        await interaction.editReply({
          embeds: [errorEmbed("No RSN linked. Use `/link` or provide an RSN.")],
        });
        return;
      }
    }

    const player = await getPlayer(rsn);
    if (!player?.latestSnapshot) {
      await interaction.editReply({ embeds: [errorEmbed(`Could not fetch data for "${rsn}".`)] });
      return;
    }

    const bosses = player.latestSnapshot.data?.bosses ?? {};
    const sorted = Object.entries(bosses)
      .filter(([, data]) => (data as { kills: number }).kills > 0)
      .sort(([, a], [, b]) => (b as { kills: number }).kills - (a as { kills: number }).kills)
      .slice(0, 15);

    if (sorted.length === 0) {
      await interaction.editReply({
        embeds: [clanEmbed().setTitle(`${player.displayName} — Boss KC`).setDescription("No boss kills tracked.")],
      });
      return;
    }

    const lines = sorted.map(([name, data], i) => {
      const displayName = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const kills = (data as { kills: number }).kills;
      return `${String(i + 1).padStart(2)}. ${displayName.padEnd(25)} ${formatNumber(kills).padStart(7)}`;
    });

    const embed = clanEmbed()
      .setTitle(`${player.displayName} — Top Boss KC`)
      .setURL(`https://wiseoldman.net/players/${encodeURIComponent(player.username)}`)
      .setDescription(`\`\`\`\n${lines.join("\n")}\n\`\`\``);

    await interaction.editReply({ embeds: [embed] });
  },
};
