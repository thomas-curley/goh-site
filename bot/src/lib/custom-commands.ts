import { Client, EmbedBuilder, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getLinkedRsn } from "./api.js";
import { getPlayer, formatNumber, getCombatLevel } from "./wom.js";
import { clanEmbed, errorEmbed } from "./embeds.js";
import type { BotCommand } from "../index.js";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SECRET = process.env.DISCORD_WEBHOOK_SECRET ?? "";

interface CommandSpec {
  type: "text" | "embed" | "random" | "wom";
  ephemeral: boolean;
  allowed_channels: string[];
  allowed_roles: string[];
  response: {
    content: string;
    title: string;
    color: string;
    footer: string;
    responses: string[];
    wom_type: string;
    wom_period: string;
  };
}

interface CustomCommandRecord {
  name: string;
  description: string;
  spec: CommandSpec;
  enabled: boolean;
}

/** Fetch all custom commands from the website API */
export async function fetchCustomCommands(): Promise<CustomCommandRecord[]> {
  try {
    const res = await fetch(`${SITE_URL}/api/commands`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.commands ?? []).filter((c: CustomCommandRecord) => c.enabled);
  } catch {
    console.error("Failed to fetch custom commands from website API");
    return [];
  }
}

/** Build a BotCommand from a command spec */
export function buildCustomCommand(record: CustomCommandRecord): BotCommand {
  const { name, description, spec } = record;

  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description || `Custom command: ${name}`);

  const execute = async (interaction: ChatInputCommandInteraction) => {
    // Check role restrictions
    if (spec.allowed_roles.length > 0 && interaction.guild) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const hasRole = spec.allowed_roles.some((roleName) =>
        member.roles.cache.some((r) => r.name.toLowerCase() === roleName.toLowerCase())
      );
      if (!hasRole) {
        await interaction.reply({ embeds: [errorEmbed("You don't have permission to use this command.")], ephemeral: true });
        return;
      }
    }

    // Check channel restrictions
    if (spec.allowed_channels.length > 0 && interaction.channelId) {
      if (!spec.allowed_channels.includes(interaction.channelId)) {
        await interaction.reply({ embeds: [errorEmbed("This command can't be used in this channel.")], ephemeral: true });
        return;
      }
    }

    await interaction.deferReply({ ephemeral: spec.ephemeral });

    switch (spec.type) {
      case "text":
        await interaction.editReply({ content: spec.response.content || "…" });
        break;

      case "embed": {
        const color = parseInt(spec.response.color.replace("#", ""), 16) || 0x2D5016;
        const embed = new EmbedBuilder()
          .setColor(color)
          .setDescription(spec.response.content || "…");
        if (spec.response.title) embed.setTitle(spec.response.title);
        if (spec.response.footer) embed.setFooter({ text: spec.response.footer });
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "random": {
        const responses = spec.response.responses.filter((r) => r.trim());
        if (responses.length === 0) {
          await interaction.editReply({ content: "No responses configured." });
          break;
        }
        const pick = responses[Math.floor(Math.random() * responses.length)];
        await interaction.editReply({ content: pick });
        break;
      }

      case "wom": {
        const rsn = await getLinkedRsn(interaction.user.id);
        if (!rsn) {
          await interaction.editReply({ embeds: [errorEmbed("Link your RSN first with `/link`.")] });
          break;
        }

        const player = await getPlayer(rsn);
        if (!player) {
          await interaction.editReply({ embeds: [errorEmbed(`Could not fetch "${rsn}" from WOM.`)] });
          break;
        }

        if (spec.response.wom_type === "stats") {
          const combat = player.combatLevel ?? getCombatLevel(player.latestSnapshot ?? {});
          const total = player.latestSnapshot?.data?.skills?.overall?.level ?? 0;
          const embed = clanEmbed()
            .setTitle(player.displayName)
            .setDescription(`⚔️ Combat: **${combat}** | Total: **${formatNumber(total)}** | XP: **${formatNumber(player.exp)}**`);
          await interaction.editReply({ embeds: [embed] });
        } else if (spec.response.wom_type === "kc") {
          const bosses = player.latestSnapshot?.data?.bosses ?? {};
          const top = Object.entries(bosses)
            .filter(([, d]) => (d as { kills: number }).kills > 0)
            .sort(([, a], [, b]) => (b as { kills: number }).kills - (a as { kills: number }).kills)
            .slice(0, 10)
            .map(([n, d]) => `${n.replace(/_/g, " ")}: **${formatNumber((d as { kills: number }).kills)}**`);
          const embed = clanEmbed()
            .setTitle(`${player.displayName} — Boss KC`)
            .setDescription(top.join("\n") || "No boss kills.");
          await interaction.editReply({ embeds: [embed] });
        } else if (spec.response.wom_type === "gains") {
          const period = spec.response.wom_period || "week";
          const res = await fetch(`https://api.wiseoldman.net/v2/players/${encodeURIComponent(rsn)}/gained?period=${period}`);
          if (res.ok) {
            const data = await res.json();
            const overall = data.data?.skills?.overall?.experience?.gained ?? 0;
            const embed = clanEmbed()
              .setTitle(`${rsn} — ${period} Gains`)
              .setDescription(`Total XP gained: **${formatNumber(overall)}**`);
            await interaction.editReply({ embeds: [embed] });
          } else {
            await interaction.editReply({ embeds: [errorEmbed("Could not fetch gains.")] });
          }
        }
        break;
      }
    }
  };

  return { data: data as unknown as SlashCommandBuilder, execute };
}
