import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, ChannelType, type VoiceChannel } from "discord.js";
import { clanEmbed, errorEmbed, successEmbed } from "../lib/embeds.js";
import {
  allowSpeaking,
  canManageRoom,
  getRoomSettings,
  isLocked,
  isStaff,
  isTempRoom,
  logRoom,
  revokeSpeaking,
  roomOwnerId,
  setLocked,
  speakers,
  transferRoom,
} from "../lib/temp-rooms.js";

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
    .addSubcommand((sub) => sub.setName("lock").setDescription("Stop new people joining (people already in stay)"))
    .addSubcommand((sub) => sub.setName("unlock").setDescription("Let people join again"))
    .addSubcommand((sub) =>
      sub
        .setName("limit")
        .setDescription("Change the most people allowed in this room")
        .addIntegerOption((opt) => opt.setName("max_people").setDescription("1-99").setMinValue(1).setMaxValue(99).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("rename")
        .setDescription("Rename this room")
        .addStringOption((opt) => opt.setName("name").setDescription("New name").setMaxLength(90).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("transfer")
        .setDescription("Hand this room to someone else")
        .addUserOption((opt) => opt.setName("member").setDescription("New owner").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("info").setDescription("Show who runs this room and who can speak"))
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
    const settings = await getRoomSettings();
    const sub = interaction.options.getSubcommand();

    // Anyone in the room can see its info.
    if (sub === "info") {
      const owner = roomOwnerId(room);
      const allowed = speakers(room);
      const embed = clanEmbed()
        .setTitle(room.name)
        .addFields(
          { name: "Run by", value: owner ? `<@${owner}>` : "Nobody", inline: true },
          { name: "People", value: `${room.members.size} / ${room.userLimit || "∞"}`, inline: true },
          { name: "Joining", value: isLocked(room) ? "🔒 Locked" : "Open", inline: true },
          { name: "Can speak", value: ["The creator and staff", ...allowed.map((id) => `<@${id}>`)].join("\n") }
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (!canManageRoom(room, member, settings)) {
      await interaction.reply({ embeds: [errorEmbed("Only the room's creator or staff can do that.")], ephemeral: true });
      return;
    }

    if (sub === "speak" || sub === "mute" || sub === "transfer") {
      const user = interaction.options.getUser("member", true);
      const target = await room.guild.members.fetch(user.id).catch(() => null);
      if (!target || target.user.bot) {
        await interaction.reply({ embeds: [errorEmbed("Pick someone in the server.")], ephemeral: true });
        return;
      }
      if (sub === "mute" && (roomOwnerId(room) === target.id || isStaff(target, settings))) {
        await interaction.reply({ embeds: [errorEmbed("The room's creator and staff can always speak.")], ephemeral: true });
        return;
      }
      if (sub === "speak") {
        await allowSpeaking(room, target);
        await interaction.reply({ embeds: [successEmbed(`<@${target.id}> can now speak in <#${room.id}>.`)] });
      } else if (sub === "mute") {
        await revokeSpeaking(room, target);
        await interaction.reply({ embeds: [successEmbed(`<@${target.id}> is muted in <#${room.id}> again.`)] });
      } else {
        await transferRoom(room, target);
        await interaction.reply({ embeds: [successEmbed(`<#${room.id}> now belongs to <@${target.id}>.`)] });
        await logRoom(room.guild, `🔁 <@${member.id}> handed **${room.name}** to <@${target.id}>.`);
      }
      return;
    }

    if (sub === "lock" || sub === "unlock") {
      await setLocked(room, sub === "lock");
      await interaction.reply({
        embeds: [successEmbed(sub === "lock" ? `🔒 <#${room.id}> is locked: nobody new can join.` : `🔓 <#${room.id}> is open again.`)],
      });
      return;
    }

    if (sub === "limit") {
      const max = interaction.options.getInteger("max_people", true);
      if (max > settings.maxRoomSize) {
        await interaction.reply({ embeds: [errorEmbed(`Rooms can hold at most ${settings.maxRoomSize} people.`)], ephemeral: true });
        return;
      }
      await room.setUserLimit(max, `/room limit by ${member.user.tag}`);
      await interaction.reply({ embeds: [successEmbed(`<#${room.id}> now allows up to ${max} ${max === 1 ? "person" : "people"}.`)] });
      return;
    }

    if (sub === "rename") {
      const name = interaction.options.getString("name", true).trim();
      // Discord only allows two renames per channel every 10 minutes.
      const renamed = await room
        .setName(name, `/room rename by ${member.user.tag}`)
        .then(() => true)
        .catch(() => false);
      await interaction.reply(
        renamed
          ? { embeds: [successEmbed(`Renamed to **${name}**.`)] }
          : { embeds: [errorEmbed("Discord only lets a channel be renamed twice every 10 minutes. Try again shortly.")], ephemeral: true }
      );
      return;
    }

    if (sub === "close") {
      const name = room.name;
      await interaction.reply({ embeds: [successEmbed(`Closing **${name}**.`)], ephemeral: true });
      await room.delete(`/room close by ${member.user.tag}`);
      await logRoom(member.guild, `🗑️ <@${member.id}> closed **${name}**.`);
    }
  },
};
