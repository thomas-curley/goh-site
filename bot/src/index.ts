import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
import { config } from "dotenv";
import { resolve } from "path";
import type { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

// Load .env from project root
config({ path: resolve(import.meta.dirname, "../../.env.local") });

// Types
export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// Extend client with commands collection
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const commands = new Collection<string, BotCommand>();

// Load commands
async function loadCommands() {
  const commandFiles = [
    await import("./commands/link.js"),
    await import("./commands/stats.js"),
    await import("./commands/levels.js"),
    await import("./commands/kc.js"),
    await import("./commands/gains.js"),
    await import("./commands/check.js"),
    await import("./commands/lfg.js"),
    await import("./commands/signup.js"),
    await import("./commands/banner.js"),
    await import("./commands/attendance.js"),
  ];

  for (const file of commandFiles) {
    const cmd = file.default as BotCommand;
    commands.set(cmd.data.name, cmd);
    console.log(`  Loaded /${cmd.data.name}`);
  }
}

// Handle interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const reply = {
      content: "Something went wrong running that command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Ready
client.once(Events.ClientReady, (c) => {
  console.log(`\n🏰 Gn0me Home Bot online as ${c.user.tag}`);
  console.log(`   Serving ${c.guilds.cache.size} guild(s)`);
  console.log(`   ${commands.size} commands loaded\n`);
});

// Start
async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error("DISCORD_BOT_TOKEN not set in .env.local");
    process.exit(1);
  }

  console.log("🌳 Loading commands...");
  await loadCommands();

  console.log("🔌 Connecting to Discord...");
  await client.login(token);
}

main().catch(console.error);
