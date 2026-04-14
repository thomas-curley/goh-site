import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, AttachmentBuilder } from "discord.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Generate an AI banner image (officers only)")
    .addStringOption((opt) =>
      opt
        .setName("type")
        .setDescription("Banner type")
        .setRequired(true)
        .addChoices(
          { name: "Event Banner", value: "pvm" },
          { name: "Skilling Banner", value: "skilling" },
          { name: "Drop Party Banner", value: "drop_party" },
          { name: "Social Banner", value: "social" },
          { name: "Announcement Banner", value: "other" },
        )
    )
    .addStringOption((opt) =>
      opt.setName("description").setDescription("What the banner should depict").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const type = interaction.options.getString("type", true);
    const description = interaction.options.getString("description", true);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    try {
      const res = await fetch(`${siteUrl}/api/banners/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: description.slice(0, 30),
          description,
          eventType: type,
          type: "event",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        await interaction.editReply({
          embeds: [errorEmbed(err.error ?? "Banner generation failed.")],
        });
        return;
      }

      const data = await res.json();

      const embed = clanEmbed()
        .setTitle("🎨 Generated Banner")
        .setImage(data.url)
        .setDescription(description);

      if (data.revised_prompt) {
        embed.setFooter({ text: `Prompt: ${data.revised_prompt.slice(0, 200)}...` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({
        embeds: [errorEmbed("Failed to generate banner. Is the website running?")],
      });
    }
  },
};
