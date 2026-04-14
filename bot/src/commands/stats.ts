import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getPlayer, formatNumber, getCombatLevel } from "../lib/wom.js";
import { getLinkedRsn } from "../lib/api.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Look up OSRS stats for yourself or another member")
    .addUserOption((opt) =>
      opt.setName("member").setDescription("Discord member to check").setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("rsn").setDescription("OSRS username (if not linked)").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("member") ?? interaction.user;
    let rsn = interaction.options.getString("rsn");

    // Resolve RSN from linked account if not provided
    if (!rsn) {
      rsn = await getLinkedRsn(target.id);
      if (!rsn) {
        await interaction.editReply({
          embeds: [errorEmbed(
            target.id === interaction.user.id
              ? "You haven't linked your RSN yet. Use `/link` or visit the website."
              : `${target.displayName} hasn't linked their RSN.`
          )],
        });
        return;
      }
    }

    const player = await getPlayer(rsn);
    if (!player) {
      await interaction.editReply({
        embeds: [errorEmbed(`Player "${rsn}" not found on Wise Old Man.`)],
      });
      return;
    }

    const snapshot = player.latestSnapshot;
    const skills = snapshot?.data?.skills;
    const combat = player.combatLevel ?? getCombatLevel(snapshot ?? {});
    const total = skills?.overall?.level ?? 0;

    // Build skill grid
    const skillOrder = [
      "attack", "hitpoints", "mining",
      "strength", "agility", "smithing",
      "defence", "herblore", "fishing",
      "ranged", "thieving", "cooking",
      "prayer", "crafting", "firemaking",
      "magic", "fletching", "woodcutting",
      "runecrafting", "slayer", "farming",
      "construction", "hunter",
    ];

    const lines = skillOrder.map((skill) => {
      const lvl = skills?.[skill]?.level ?? 1;
      const name = skill.charAt(0).toUpperCase() + skill.slice(1);
      return `${name.padEnd(13)} ${String(lvl).padStart(4)}`;
    });

    // Format as two columns
    const mid = Math.ceil(lines.length / 2);
    const left = lines.slice(0, mid);
    const right = lines.slice(mid);
    const grid = left.map((l, i) => `${l}  ${right[i] ?? ""}`).join("\n");

    const embed = clanEmbed()
      .setTitle(`${player.displayName}`)
      .setURL(`https://wiseoldman.net/players/${encodeURIComponent(player.username)}`)
      .setDescription(
        `⚔️ Combat: **${combat}** | Total: **${formatNumber(total)}** | XP: **${formatNumber(player.exp)}**\n` +
        `EHP: **${formatNumber(Math.round(player.ehp))}** | EHB: **${formatNumber(Math.round(player.ehb))}**`
      )
      .addFields({ name: "Skills", value: `\`\`\`\n${grid}\n\`\`\`` });

    if (player.type !== "regular") {
      embed.setDescription(
        `🛡️ ${player.type.replace(/_/g, " ").toUpperCase()}\n` + embed.data.description
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
