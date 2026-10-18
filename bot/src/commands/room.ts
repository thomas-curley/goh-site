import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, ChannelType, type VoiceChannel } from "discord.js";
import { errorEmbed, successEmbed } from "../lib/embeds.js";
import { MAX_ROOM_SIZE, allowSpeaking, canManageRoom, isStaff, isTempRoom, revokeSpeaking, roomOwnerId } from "../lib/temp-rooms.js";

export default {
  data: new SlashCommandBuilder()
    .setName("room")
    .setDescription("Manage the temporary room you're in (creator or staff)")
    .addSubcommand((sub) =>
      sub
        .setName("speak")
        .setDescription("Let someone talk in this room")
        .addUserOption((opt) => opt.setName("member").setDescription("Who can speak").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("mute")
        .setDescription("Mute someone in this room again")
        .addUserOption((opt) => opt.setName("member").setDescription("Who to mute").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("limit")
        .setDescription("Change the most people allowed in this room")
        .addIntegerOption((opt) =>
          opt.setName("max_people").setDescription(`1-${MAX_ROOM_SIZE}`).setMinValue(1).setMaxValue(MAX_ROOM_SIZE).setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("close").setDescription("Delete this room")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild() || !(interaction.member instanceof GuildMember)) {
      await interaction.reply({ embeds: [errorEmbed("Use this in the server.")], ephemeral: true });
      return;
    }
    const member = interaction.member;
    const channel = member.voice.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice || !isTempRoom(channel)) {
      await interaction.reply({ embeds: [errorEmbed("Join the temporary room you want to manage first.")], ephemeral: true });
      return;
    }
    const room = channel as VoiceChannel;
    if (!canManageRoom(room, member)) {
      await interaction.reply({ embeds: [errorEmbed("Only the room's creator or staff can do that.")], ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "speak" || sub === "mute") {
      const user = interaction.options.getUser("member", true);
      const target = await room.guild.members.fetch(user.id).catch(() => null);
      if (!target) {
        await interaction.reply({ embeds: [errorEmbed("That person isn't in the server.")], ephemeral: true });
        return;
      }
      if (sub === "mute" && (roomOwnerId(room) === target.id || isStaff(target))) {
        await interaction.reply({ embeds: [errorEmbed("The room's creator and staff can always speak.")], ephemeral: true });
        return;
      }
      if (sub === "speak") await allowSpeaking(room, target);
      else await revokeSpeaking(room, target);
      await interaction.reply({
        embeds: [successEmbed(sub === "speak" ? `<@${target.id}> can now speak in <#${room.id}>.` : `<@${target.id}> is muted in <#${room.id}> again.`)],
      });
      return;
    }

    if (sub === "limit") {
      const max = interaction.options.getInteger("max_people", true);
      await room.setUserLimit(max, `/room limit by ${member.user.tag}`);
      await interaction.reply({ embeds: [successEmbed(`<#${room.id}> now allows up to ${max} ${max === 1 ? "person" : "people"}.`)] });
      return;
    }

    if (sub === "close") {
      await interaction.reply({ embeds: [successEmbed(`Closing **${room.name}**.`)], ephemeral: true });
      await room.delete(`/room close by ${member.user.tag}`);
    }
  },
};
