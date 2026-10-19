import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from "discord.js";
import { getBingoBoards, submitBingoProof } from "../lib/api.js";
import { clanEmbed, errorEmbed, successEmbed } from "../lib/embeds.js";

const NOT_LINKED = "Link your Discord on the website first (sign in there with Discord), so I know which RSN and team you are.";

export default {
  data: new SlashCommandBuilder()
    .setName("bingo")
    .setDescription("Clan bingo: send proof or check your team")
    .addSubcommand((sub) =>
      sub
        .setName("submit")
        .setDescription("Send a screenshot for one of your team's bingo tiles")
        .addStringOption((opt) => opt.setName("tile").setDescription("Which tile (start typing)").setRequired(true).setAutocomplete(true))
        .addAttachmentOption((opt) => opt.setName("screenshot").setDescription("The drop or proof").setRequired(true))
        .addAttachmentOption((opt) => opt.setName("screenshot2").setDescription("Another screenshot (optional)").setRequired(false))
        .addIntegerOption((opt) => opt.setName("count").setDescription("How many this shows, for count tiles (default 1)").setMinValue(1).setMaxValue(1000).setRequired(false))
        .addStringOption((opt) => opt.setName("note").setDescription("Anything staff should know").setMaxLength(300).setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("board").setDescription("Your team's score, rank and tiles left")),

  async autocomplete(interaction: AutocompleteInteraction) {
    const typed = interaction.options.getFocused().toLowerCase();
    const { boards } = await getBingoBoards(interaction.user.id);
    const choices = boards.flatMap((b) =>
      b.tiles
        .filter((t) => t.kind === "proof" && !t.done && t.title.toLowerCase().includes(typed))
        .map((t) => ({ name: `${t.title} (${t.points} pts)${boards.length > 1 ? ` · ${b.name}` : ""}`.slice(0, 100), value: t.id }))
    );
    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "submit") {
      await interaction.deferReply({ ephemeral: true });
      const attachments = [interaction.options.getAttachment("screenshot"), interaction.options.getAttachment("screenshot2")].filter((a) => a !== null);
      const notImage = attachments.find((a) => !a.contentType?.startsWith("image/"));
      if (notImage) {
        await interaction.editReply({ embeds: [errorEmbed("Attach a screenshot (PNG or JPG).")] });
        return;
      }
      const result = await submitBingoProof({
        discordId: interaction.user.id,
        tileId: interaction.options.getString("tile", true),
        attachmentUrls: attachments.map((a) => a.url),
        quantity: interaction.options.getInteger("count") ?? undefined,
        note: interaction.options.getString("note"),
      });
      if (!result.ok) {
        await interaction.editReply({ embeds: [errorEmbed(result.error ?? "That didn't go through. Try again, or send it on the website.")] });
        return;
      }
      await interaction.editReply({
        embeds: [successEmbed(`Sent **${result.tileTitle}** for ${result.teamName} in ${result.eventName}. Staff will review it, and you'll see the result on the board.`)],
      });
      return;
    }

    // board
    await interaction.deferReply({ ephemeral: true });
    const { linked, boards } = await getBingoBoards(interaction.user.id);
    if (!linked) {
      await interaction.editReply({ embeds: [errorEmbed(NOT_LINKED)] });
      return;
    }
    if (boards.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed("You're not on a team for a live bingo right now.")] });
      return;
    }
    const embeds = boards.slice(0, 3).map((b) => {
      const me = b.standings.find((s) => s.mine);
      const left = b.tiles.filter((t) => !t.done);
      const ends = b.endsAt ? `<t:${Math.floor(Date.parse(b.endsAt) / 1000)}:R>` : "when staff end it";
      return clanEmbed()
        .setTitle(`🎯 ${b.name}`)
        .setURL(b.url || null)
        .setDescription(
          [
            me ? `**${b.teamName}** is **#${me.rank}** with **${me.total} points** (${me.tilesDone} tiles, ${me.lines} lines).` : `You're on **${b.teamName}**.`,
            `Ends ${ends}.`,
            "",
            "**Standings**",
            ...b.standings.map((s) => `${s.rank}. ${s.mine ? `**${s.name}**` : s.name}: ${s.total}`),
            "",
            `**${left.length} tiles left**`,
            left
              .slice(0, 12)
              .map((t) => `• ${t.title}${t.kind === "auto" ? ` (${t.progress})` : ""}`)
              .join("\n") + (left.length > 12 ? `\n…and ${left.length - 12} more on the website` : ""),
          ].join("\n")
        );
    });
    await interaction.editReply({ embeds });
  },
};
