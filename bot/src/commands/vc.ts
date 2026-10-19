import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { clanEmbed, errorEmbed } from "../lib/embeds.js";
import { canCreateRooms, createRoom, getRoomSettings, isStaff, logRoom, ownedRooms } from "../lib/temp-rooms.js";

export default {
  data: new SlashCommandBuilder()
    .setName("vc")
    .setDescription("Create a temporary voice room where only you and staff can speak")
    .addIntegerOption((opt) =>
      opt.setName("max_people").setDescription("Most people allowed in the room").setMinValue(1).setMaxValue(99).setRequired(false)
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
    const settings = await getRoomSettings();

    if (!settings.enabled) {
      await interaction.reply({ embeds: [errorEmbed("Creating rooms is turned off right now.")], ephemeral: true });
      return;
    }
    if (!canCreateRooms(member, settings)) {
      await interaction.reply({ embeds: [errorEmbed("You don't have a role that can create rooms.")], ephemeral: true });
      return;
    }

    const requested = interaction.options.getInteger("max_people") ?? settings.defaultMaxPeople;
    if (requested > settings.maxRoomSize) {
      await interaction.reply({ embeds: [errorEmbed(`Rooms can hold at most ${settings.maxRoomSize} people.`)], ephemeral: true });
      return;
    }

    const owned = ownedRooms(member.guild, member.id);
    if (owned.length >= settings.roomsPerPerson && !isStaff(member, settings)) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            `You already have ${owned.map((r) => `<#${r.id}>`).join(", ")}. Close it with \`/room close\` (from inside the room) before making another.`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const room = await createRoom(member, requested, interaction.options.getString("name"), settings);

    // Bring the creator straight in if they're already in voice.
    if (member.voice.channelId) await member.voice.setChannel(room).catch(() => undefined);

    const embed = clanEmbed()
      .setTitle("🔇 Room created")
      .setDescription(
        [
          `Join <#${room.id}> (up to ${requested} ${requested === 1 ? "person" : "people"}).`,
          `Only <@${member.id}> and staff can speak; everyone else joins muted.`,
          "",
          "**From inside the room, the creator or staff can use:**",
          "`/room speak @member` / `/room mute @member`: let someone talk, or mute them again",
          "`/room lock` / `/room unlock`: stop or allow new people joining",
          "`/room limit <number>` · `/room rename <name>` · `/room transfer @member`",
          "`/room info` · `/room close`",
          "",
          "Empty rooms are removed automatically.",
        ].join("\n")
      );
    await interaction.editReply({ embeds: [embed] });
    await logRoom(member.guild, `🔇 <@${member.id}> created **${room.name}** (<#${room.id}>, up to ${requested}).`);
  },
};
