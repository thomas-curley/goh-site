import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { getPlayer, formatNumber, getCombatLevel } from "../lib/wom.js";
import { lookupUser } from "../lib/api.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("Full player profile check (officers only)")
    .addUserOption((opt) =>
      opt.setName("member").setDescription("Discord member to check").setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("rsn").setDescription("OSRS username").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("member");
    let rsn = interaction.options.getString("rsn");

    // Resolve RSN
    let linkInfo: { rsn: string | null; discord_username: string; clan_rank: string | null } | null = null;
    if (targetUser) {
      linkInfo = await lookupUser(targetUser.id);
      if (linkInfo?.rsn) rsn = linkInfo.rsn;
    }

    if (!rsn) {
      await interaction.editReply({
        embeds: [errorEmbed("Provide an RSN or a Discord member with a linked account.")],
      });
      return;
    }

    const player = await getPlayer(rsn);
    if (!player) {
      await interaction.editReply({ embeds: [errorEmbed(`Player "${rsn}" not found on WOM.`)] });
      return;
    }

    const snapshot = player.latestSnapshot;
    const combat = player.combatLevel ?? getCombatLevel(snapshot ?? {});
    const total = snapshot?.data?.skills?.overall?.level ?? 0;

    // Top bosses
    const bosses = snapshot?.data?.bosses ?? {};
    const topBosses = Object.entries(bosses)
      .filter(([, d]) => (d as { kills: number }).kills > 0)
      .sort(([, a], [, b]) => (b as { kills: number }).kills - (a as { kills: number }).kills)
      .slice(0, 8)
      .map(([name, d]) => {
        const displayName = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return `${displayName}: **${formatNumber((d as { kills: number }).kills)}**`;
      });

    const embed = clanEmbed()
      .setTitle(`Player Check: ${player.displayName}`)
      .setURL(`https://wiseoldman.net/players/${encodeURIComponent(player.username)}`)
      .addFields(
        { name: "Account Type", value: player.type.replace(/_/g, " ").toUpperCase(), inline: true },
        { name: "Combat", value: String(combat), inline: true },
        { name: "Total Level", value: formatNumber(total), inline: true },
        { name: "Total XP", value: formatNumber(player.exp), inline: true },
        { name: "EHP", value: formatNumber(Math.round(player.ehp)), inline: true },
        { name: "EHB", value: formatNumber(Math.round(player.ehb)), inline: true },
      );

    if (topBosses.length > 0) {
      embed.addFields({ name: "Top Bosses", value: topBosses.join("\n") });
    }

    // Link status
    if (linkInfo) {
      embed.addFields({
        name: "Discord Link",
        value: `✅ Linked to **${linkInfo.discord_username}**${linkInfo.clan_rank ? ` (${linkInfo.clan_rank})` : ""}`,
      });
    } else if (targetUser) {
      embed.addFields({ name: "Discord Link", value: "❌ Not linked" });
    }

    // Dates
    if (player.registeredAt) {
      embed.addFields({
        name: "WOM Registered",
        value: new Date(player.registeredAt).toLocaleDateString(),
        inline: true,
      });
    }
    if (player.updatedAt) {
      embed.addFields({
        name: "Last Updated",
        value: new Date(player.updatedAt).toLocaleDateString(),
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
