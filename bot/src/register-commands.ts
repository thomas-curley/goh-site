import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(import.meta.dirname, "../../.env.local") });

const commands = [
  (await import("./commands/link.js")).default,
  (await import("./commands/stats.js")).default,
  (await import("./commands/levels.js")).default,
  (await import("./commands/kc.js")).default,
  (await import("./commands/gains.js")).default,
  (await import("./commands/check.js")).default,
  (await import("./commands/lfg.js")).default,
  (await import("./commands/signup.js")).default,
  (await import("./commands/banner.js")).default,
  (await import("./commands/attendance.js")).default,
];

const token = process.env.DISCORD_BOT_TOKEN!;
const clientId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.env.DISCORD_GUILD_ID!;

const rest = new REST({ version: "10" }).setToken(token);

console.log(`Registering ${commands.length} commands...`);

await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
  body: commands.map((cmd) => cmd.data.toJSON()),
});

console.log("✅ Commands registered successfully!");
