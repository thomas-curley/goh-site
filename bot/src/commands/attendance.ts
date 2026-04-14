import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("attendance")
    .setDescription("Post voice channel members as event attendees (officers only)")
    .addStringOption((opt) =>
      opt.setName("event_id").setDescription("Event ID from the website").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const eventId = interaction.options.getString("event_id", true);
    const guild = interaction.guild;

    if (!guild) {
      await interaction.editReply({ embeds: [errorEmbed("This command must be used in a server.")] });
      return;
    }

    // Get the user's current voice channel
    const member = await guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.editReply({
        embeds: [errorEmbed("You must be in a voice channel to snapshot attendees.")],
      });
      return;
    }

    // Get all members in the voice channel
    const voiceMembers = voiceChannel.members.filter((m) => !m.user.bot);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const secret = process.env.DISCORD_WEBHOOK_SECRET ?? "";

    let added = 0;
    for (const [, vm] of voiceMembers) {
      try {
        await fetch(`${siteUrl}/api/events/${eventId}/attendance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({
            action: "add_manual",
            discord_id: vm.id,
            discord_username: vm.user.username,
            discord_nickname: vm.nickname,
            attended: true,
            marked_by: interaction.user.displayName,
          }),
        });
        added++;
      } catch {
        // Skip individual failures
      }
    }

    await interaction.editReply({
      embeds: [
        clanEmbed()
          .setTitle("📋 Voice Channel Attendance")
          .setDescription(
            `Added **${added}** members from **${voiceChannel.name}** to the attendance list.\n\n` +
            `Members: ${voiceMembers.map((m) => m.displayName).join(", ")}`
          ),
      ],
    });
  },
};
