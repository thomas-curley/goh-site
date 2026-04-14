import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
} from "discord.js";
import { clanEmbed, successEmbed, errorEmbed } from "../lib/embeds.js";
import { fetchCustomCommands, buildCustomCommand } from "../lib/custom-commands.js";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// In-memory sessions for multi-step flow
const sessions = new Map<string, {
  name: string;
  description: string;
  type: string;
  content: string;
  title: string;
  color: string;
  footer: string;
  responses: string[];
  wom_type: string;
  wom_period: string;
  ephemeral: boolean;
}>();

export default {
  data: new SlashCommandBuilder()
    .setName("command")
    .setDescription("Manage custom commands")
    .addSubcommand((sub) =>
      sub.setName("create").setDescription("Create a custom command")
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all custom commands")
    )
    .addSubcommand((sub) =>
      sub.setName("reload").setDescription("Reload custom commands from the website")
    )
    .addSubcommand((sub) =>
      sub.setName("delete").setDescription("Delete a custom command")
        .addStringOption((opt) => opt.setName("name").setDescription("Command name").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "create":
        await handleCreate(interaction);
        break;
      case "list":
        await handleList(interaction);
        break;
      case "reload":
        await handleReload(interaction);
        break;
      case "delete":
        await handleDelete(interaction);
        break;
    }
  },
};

async function handleCreate(interaction: ChatInputCommandInteraction) {
  // Step 1: Basic info modal
  const modal = new ModalBuilder()
    .setCustomId(`cmd_basic_${interaction.user.id}`)
    .setTitle("Create Custom Command")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("name")
          .setLabel("Command Name (lowercase, no spaces)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("my-command")
          .setRequired(true)
          .setMaxLength(32)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("description")
          .setLabel("Description")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("What this command does")
          .setRequired(false)
          .setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("content")
          .setLabel("Response Content")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("The text the bot will respond with...")
          .setRequired(true)
          .setMaxLength(2000)
      ),
    );

  await interaction.showModal(modal);

  // Wait for modal submit
  let modalSubmit: ModalSubmitInteraction;
  try {
    modalSubmit = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === `cmd_basic_${interaction.user.id}`,
      time: 300_000,
    });
  } catch {
    return; // Timed out
  }

  const name = modalSubmit.fields.getTextInputValue("name").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const description = modalSubmit.fields.getTextInputValue("description");
  const content = modalSubmit.fields.getTextInputValue("content");

  // Store session
  sessions.set(interaction.user.id, {
    name, description, type: "text", content,
    title: "", color: "#2D5016", footer: "Gn0me Home",
    responses: [content], wom_type: "stats", wom_period: "week",
    ephemeral: false,
  });

  // Step 2: Response type select
  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId(`cmd_type_${interaction.user.id}`)
    .setPlaceholder("Choose response type...")
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Plain Text").setValue("text").setDescription("Simple text response"),
      new StringSelectMenuOptionBuilder().setLabel("Embed").setValue("embed").setDescription("Rich embed with title and color"),
      new StringSelectMenuOptionBuilder().setLabel("Random").setValue("random").setDescription("Random pick from a list"),
      new StringSelectMenuOptionBuilder().setLabel("WOM Data").setValue("wom").setDescription("Fetch player stats"),
    );

  const saveBtn = new ButtonBuilder()
    .setCustomId(`cmd_save_${interaction.user.id}`)
    .setLabel("Save Command")
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`cmd_cancel_${interaction.user.id}`)
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const reply = await modalSubmit.reply({
    content: `Command **/${name}** — choose response type, then save:`,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(saveBtn, cancelBtn),
    ],
    ephemeral: true,
  });

  // Collect interactions
  const collector = reply.createMessageComponentCollector({
    time: 300_000,
  });

  collector.on("collect", async (i) => {
    const session = sessions.get(interaction.user.id);
    if (!session) return;

    if (i.isStringSelectMenu() && i.customId === `cmd_type_${interaction.user.id}`) {
      session.type = i.values[0];
      await (i as StringSelectMenuInteraction).update({
        content: `Command **/${session.name}** — Type: **${session.type}**. Click Save when ready.`,
      });
    }

    if (i.isButton() && i.customId === `cmd_save_${interaction.user.id}`) {
      collector.stop();

      // Save via website API
      const spec = {
        type: session.type,
        ephemeral: session.ephemeral,
        allowed_channels: [],
        allowed_roles: [],
        response: {
          content: session.content,
          title: session.title,
          color: session.color,
          footer: session.footer,
          responses: session.type === "random" ? session.content.split("\n").filter((l) => l.trim()) : [],
          wom_type: session.wom_type,
          wom_period: session.wom_period,
        },
      };

      try {
        const res = await fetch(`${SITE_URL}/api/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: session.name, description: session.description, spec }),
        });

        if (res.ok) {
          await (i as ButtonInteraction).update({
            content: "",
            embeds: [successEmbed(`Command **/${session.name}** saved! Use \`/command reload\` to activate it.`)],
            components: [],
          });
        } else {
          const err = await res.json();
          await (i as ButtonInteraction).update({
            content: "",
            embeds: [errorEmbed(err.error ?? "Failed to save command.")],
            components: [],
          });
        }
      } catch {
        await (i as ButtonInteraction).update({
          content: "",
          embeds: [errorEmbed("Failed to save. Is the website running?")],
          components: [],
        });
      }

      sessions.delete(interaction.user.id);
    }

    if (i.isButton() && i.customId === `cmd_cancel_${interaction.user.id}`) {
      collector.stop();
      sessions.delete(interaction.user.id);
      await (i as ButtonInteraction).update({
        content: "Command creation cancelled.",
        components: [],
        embeds: [],
      });
    }
  });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const commands = await fetchCustomCommands();

  if (commands.length === 0) {
    await interaction.editReply({
      embeds: [clanEmbed().setTitle("Custom Commands").setDescription("No custom commands configured.")],
    });
    return;
  }

  const lines = commands.map((cmd) =>
    `**/${cmd.name}** — ${cmd.description || cmd.spec.type} ${!cmd.enabled ? "(disabled)" : ""}`
  );

  await interaction.editReply({
    embeds: [clanEmbed().setTitle(`Custom Commands (${commands.length})`).setDescription(lines.join("\n"))],
  });
}

async function handleReload(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const commands = await fetchCustomCommands();
  const client = interaction.client;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.editReply({ embeds: [errorEmbed("Must be used in a server.")] });
    return;
  }

  // Register each custom command
  for (const cmd of commands) {
    const built = buildCustomCommand(cmd);
    client.application?.commands.cache;
    // Add to guild commands
    await client.application?.commands.create(built.data.toJSON(), guildId);
  }

  await interaction.editReply({
    embeds: [successEmbed(`Reloaded **${commands.length}** custom command(s). They may take a moment to appear.`)],
  });
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const name = interaction.options.getString("name", true);

  const res = await fetch(`${SITE_URL}/api/commands/${name}`, { method: "DELETE" });
  if (res.ok) {
    await interaction.editReply({ embeds: [successEmbed(`Deleted **/${name}**. Use \`/command reload\` to update.`)] });
  } else {
    await interaction.editReply({ embeds: [errorEmbed(`Failed to delete "/${name}".`)] });
  }
}
