export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

export function formatLevel(level: number): string {
  return level.toLocaleString();
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getAccountTypeLabel(type: string): string {
  const map: Record<string, string> = {
    regular: "Main",
    ironman: "Ironman",
    hardcore: "HCIM",
    ultimate: "UIM",
    group_ironman: "GIM",
    hardcore_group_ironman: "HCGIM",
    unranked_group_ironman: "UGIM",
  };
  return map[type] ?? type;
}

export function getAccountTypeColor(type: string): string {
  const map: Record<string, string> = {
    regular: "",
    ironman: "text-iron-grey",
    hardcore: "text-red-accent",
    ultimate: "text-iron-grey",
    group_ironman: "text-iron-grey",
    hardcore_group_ironman: "text-red-accent",
  };
  return map[type] ?? "";
}
