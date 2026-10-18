import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";
import { MAX_ROOM_SIZE, createRoom, ownedRoom } from "../lib/temp-rooms.js";

export default {
  data: new SlashCommandBuilder()
    .setName("create-room")
    .setDescription("Create a temporary voice room where only you and staff can speak")
    .addIntegerOption((opt) =>
      opt
        .setName("max_people")
        .setDescription(`Most people allowed in the room (1-${MAX_ROOM_SIZE})`)
        .setMinValue(1)
        .setMaxValue(MAX_ROOM_SIZE)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("name").setDescription("Room name (default: your name's room)").setMaxLength(90).setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild() || !(interaction.member instanceof GuildMember)) {
      await interaction.reply({ embeds: [errorEmbed("Use this in the server.")], ephemeral: true });
      return;
    }
    const member = interaction.member;
    const maxPeople = interaction.options.getInteger("max_people", true);
    const name = interaction.options.getString("name");

    const existing = ownedRoom(member.guild, member.id);
    if (existing) {
      await interaction.reply({
        embeds: [errorEmbed(`You already have a room: <#${existing.id}>. Close it with \`/room close\` before making another.`)],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const room = await createRoom(member, maxPeople, name);

    // Bring the creator straight in if they're already in voice.
    if (member.voice.channelId) await member.voice.setChannel(room).catch(() => undefined);

    const embed = clanEmbed()
      .setTitle("🔇 Room created")
      .setDescription(
        [
          `Join <#${room.id}> (up to ${maxPeople} ${maxPeople === 1 ? "person" : "people"}).`,
          `Only <@${member.id}> and staff can speak; everyone else joins muted.`,
          "",
          "**In the room, the creator or staff can use:**",
          "`/room speak @member`: let someone talk",
          "`/room mute @member`: mute them again",
          "`/room limit <number>`: change the max people",
          "`/room close`: delete the room",
          "",
          "Empty rooms are cleaned up automatically every 30 minutes.",
        ].join("\n")
      );
    await interaction.editReply({ embeds: [embed] });
  },
};
