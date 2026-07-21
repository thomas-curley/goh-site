/**
 * Shared renderer for admin-defined Discord post templates. Pure string
 * manipulation over plain objects — no server-only imports — so it can be
 * called identically from an API route (the real post) and a "use client"
 * editor/preview component (see supabase/migrations/008_post_templates.sql
 * for the schema this interprets).
 */

export type BlockType = "role_ping_prefix" | "line" | "paragraph" | "list" | "static_text";
export type ContentType = "announcement" | "event_post" | "event_recap" | "signup_thread";

export interface RolePingPrefixConfig {
  [key: string]: never;
}

export interface LineConfig {
  emoji?: string;
  template: string;
  requireKeys?: string[];
  skipIf?: { key: string; equals: string };
}

export interface ParagraphConfig {
  bindKey: string;
  headingEmoji?: string;
  headingTemplate?: string;
}

export interface ListConfig {
  bindKey: string;
  splitNewlines: boolean;
  style: "bullet" | "medal";
  itemPrefix?: string;
  itemTemplate: string;
  headingEmoji?: string;
  headingTemplate?: string;
  fallbackBindKey?: string;
  fallbackTemplate?: string;
}

export interface StaticTextConfig {
  emoji?: string;
  template: string;
}

export type SectionConfig = RolePingPrefixConfig | LineConfig | ParagraphConfig | ListConfig | StaticTextConfig;

export interface SectionInstance {
  instance_id: string;
  source_section_id: string | null;
  block_type: BlockType;
  label: string;
  blankLineBefore: boolean;
  config: SectionConfig;
}

export interface PostSection {
  id: string;
  name: string;
  description: string;
  block_type: BlockType;
  config: SectionConfig;
  is_active: boolean;
}

export interface PostTemplate {
  id: string;
  content_type: ContentType;
  name: string;
  description: string;
  is_default: boolean;
  sections: SectionInstance[];
}

/** Turns role IDs into Discord mention syntax (`@everyone`/`@here`/`<@&id>`). */
export function formatRolePingMentions(roleIds: string[]): string {
  return roleIds
    .map((id) => {
      if (id === "@everyone") return "@everyone";
      if (id === "@here") return "@here";
      return `<@&${id}>`;
    })
    .join(" ");
}

function substitute(template: string, emoji: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key === "emoji") return emoji;
    const value = data[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

function renderRolePingPrefix(data: Record<string, unknown>): string | null {
  const roles = data.pingRoles;
  if (!Array.isArray(roles) || roles.length === 0) return null;
  return formatRolePingMentions(roles as string[]);
}

function renderLine(config: LineConfig, data: Record<string, unknown>): string | null {
  if (config.skipIf && String(data[config.skipIf.key] ?? "") === config.skipIf.equals) return null;
  if (config.requireKeys?.some((key) => !data[key])) return null;
  return substitute(config.template, config.emoji ?? "", data);
}

function renderParagraph(config: ParagraphConfig, data: Record<string, unknown>): string | null {
  const value = data[config.bindKey];
  if (!value || !String(value).trim()) return null;

  const lines: string[] = [];
  if (config.headingTemplate) {
    lines.push(substitute(config.headingTemplate, config.headingEmoji ?? "", data));
  }
  lines.push(String(value).trim());
  return lines.join("\n");
}

function renderList(config: ListConfig, data: Record<string, unknown>): string | null {
  let items: unknown[] = [];
  const raw = data[config.bindKey];

  if (config.splitNewlines) {
    if (typeof raw === "string" && raw.trim()) {
      items = raw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^[•\-*]\s*/, ""));
    }
  } else if (Array.isArray(raw)) {
    items = raw;
  }

  if (items.length === 0) {
    const fallbackValue = config.fallbackBindKey ? data[config.fallbackBindKey] : undefined;
    if (fallbackValue && String(fallbackValue).trim() && config.fallbackTemplate) {
      const emoji = config.headingEmoji ?? "";
      return config.fallbackTemplate
        .replace(/\{emoji\}/g, emoji)
        .replace(/\{value\}/g, String(fallbackValue));
    }
    return null;
  }

  const lines: string[] = [];
  if (config.headingTemplate) {
    lines.push(substitute(config.headingTemplate, config.headingEmoji ?? "", data));
  }

  items.forEach((item, i) => {
    if (config.style === "medal") {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎖️";
      const obj = (item ?? {}) as { rsn?: string; prize?: string };
      const prizeSuffix = obj.prize?.trim() ? ` — ${obj.prize}` : "";
      const line = config.itemTemplate
        .replace(/\{rsn\}/g, obj.rsn ?? "")
        .replace(/\{prizeSuffix\}/g, prizeSuffix);
      lines.push(`${medal} ${line}`);
    } else {
      const prefix = config.itemPrefix ?? "";
      const value = typeof item === "string" ? item : String(item);
      lines.push(`${prefix}${config.itemTemplate.replace(/\{value\}/g, value)}`);
    }
  });

  return lines.join("\n");
}

function renderStaticText(config: StaticTextConfig): string {
  return config.template.replace(/\{emoji\}/g, config.emoji ?? "");
}

function renderInstance(instance: SectionInstance, data: Record<string, unknown>): string | null {
  switch (instance.block_type) {
    case "role_ping_prefix":
      return renderRolePingPrefix(data);
    case "line":
      return renderLine(instance.config as LineConfig, data);
    case "paragraph":
      return renderParagraph(instance.config as ParagraphConfig, data);
    case "list":
      return renderList(instance.config as ListConfig, data);
    case "static_text":
      return renderStaticText(instance.config as StaticTextConfig);
    default:
      return null;
  }
}

/**
 * Renders an ordered list of section instances against a data object into
 * the final Discord message text. Instances whose bound data is missing are
 * skipped entirely (no stray blank sections); `blankLineBefore` on each
 * instance controls whether a blank-line gap precedes it, but only between
 * two sections that both actually rendered — a skipped section never leaves
 * a dangling blank line behind.
 */
export function renderTemplate(sections: SectionInstance[], data: Record<string, unknown>): string {
  const out: string[] = [];
  for (const instance of sections) {
    const rendered = renderInstance(instance, data);
    if (rendered === null) continue;
    if (out.length > 0 && instance.blankLineBefore) out.push("");
    out.push(rendered);
  }
  return out.join("\n");
}
