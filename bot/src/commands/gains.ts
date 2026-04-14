import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { formatNumber } from "../lib/wom.js";
import { getLinkedRsn } from "../lib/api.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("gains")
    .setDescription("Show XP gains over a time period")
    .addUserOption((opt) =>
      opt.setName("member").setDescription("Discord member to check").setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("period")
        .setDescription("Time period")
        .setRequired(false)
        .addChoices(
          { name: "Day", value: "day" },
          { name: "Week", value: "week" },
          { name: "Month", value: "month" },
          { name: "Year", value: "year" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("member") ?? interaction.user;
    const period = interaction.options.getString("period") ?? "week";

    const rsn = await getLinkedRsn(target.id);
    if (!rsn) {
      await interaction.editReply({
        embeds: [errorEmbed("No RSN linked. Use `/link` or visit the website.")],
      });
      return;
    }

    const res = await fetch(
      `https://api.wiseoldman.net/v2/players/${encodeURIComponent(rsn)}/gained?period=${period}`
    );
    if (!res.ok) {
      await interaction.editReply({ embeds: [errorEmbed(`Could not fetch gains for "${rsn}".`)] });
      return;
    }

    const data = await res.json();
    const skills = data.data?.skills ?? {};

    // Get top gained skills
    const gained = Object.entries(skills)
      .filter(([key]) => key !== "overall")
      .map(([name, s]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        xp: (s as { experience: { gained: number } }).experience?.gained ?? 0,
      }))
      .filter((s) => s.xp > 0)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10);

    const overall = skills.overall?.experience?.gained ?? 0;
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

    const embed = clanEmbed()
      .setTitle(`${rsn} — ${periodLabel} Gains`)
      .setURL(`https://wiseoldman.net/players/${encodeURIComponent(rsn)}`)
      .setDescription(`Total XP gained: **${formatNumber(overall)}**`);

    if (gained.length > 0) {
      const lines = gained.map(
        (s) => `${s.name.padEnd(13)} +${formatNumber(s.xp)}`
      );
      embed.addFields({ name: "Top Skills", value: `\`\`\`\n${lines.join("\n")}\n\`\`\`` });
    } else {
      embed.addFields({ name: "Top Skills", value: "No gains this period." });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
