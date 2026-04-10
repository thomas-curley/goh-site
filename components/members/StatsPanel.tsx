import { cn } from "@/lib/utils";
import { SKILLS_ORDER } from "@/lib/constants";

interface SkillEntry {
  metric: string;
  level: number;
  experience: number;
  rank: number;
}

interface StatsPanelProps {
  skills: Record<string, SkillEntry>;
}

const SKILL_DISPLAY_NAMES: Record<string, string> = {
  attack: "Attack",
  hitpoints: "Hitpoints",
  mining: "Mining",
  strength: "Strength",
  agility: "Agility",
  smithing: "Smithing",
  defence: "Defence",
  herblore: "Herblore",
  fishing: "Fishing",
  ranged: "Ranged",
  thieving: "Thieving",
  cooking: "Cooking",
  prayer: "Prayer",
  crafting: "Crafting",
  firemaking: "Firemaking",
  magic: "Magic",
  fletching: "Fletching",
  woodcutting: "Woodcutting",
  runecrafting: "Runecraft",
  slayer: "Slayer",
  farming: "Farming",
  construction: "Construction",
  hunter: "Hunter",
  overall: "Total",
};

function getLevelColor(level: number): string {
  if (level >= 99) return "text-gold-display";
  if (level >= 50) return "text-gnome-green";
  return "text-text-primary";
}

export function StatsPanel({ skills }: StatsPanelProps) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {SKILLS_ORDER.map((skill) => {
        const data = skills[skill];
        const level = data?.level ?? 1;
        const name = SKILL_DISPLAY_NAMES[skill] ?? skill;
        const isTotal = skill === "overall";

        return (
          <div
            key={skill}
            className={cn(
              "px-3 py-2 flex items-center justify-between gap-2 rounded-md",
              isTotal
                ? "col-span-3 bg-bark-brown border border-bark-brown-light text-text-light"
                : "card-wood"
            )}
          >
            <span
              className={cn(
                "text-xs font-body truncate",
                isTotal ? "text-parchment font-bold text-sm" : "text-bark-brown-light"
              )}
            >
              {name}
            </span>
            <span
              className={cn(
                "font-stats font-bold text-sm",
                isTotal ? "text-gold-display text-lg" : getLevelColor(level)
              )}
            >
              {level.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
