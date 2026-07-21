/**
 * Best-effort conversion of a pasted Discord-style template (like the
 * hand-written ones officers keep pinned in Discord) into an editable
 * sequence of post_templates sections.
 *
 * This is a starting point to refine in the Template Editor, not a
 * lossless one-shot conversion: bracket placeholders whose label matches a
 * field this app actually has data for (Event Name, Date, World, Host,
 * etc.) become live {field} bindings; anything it doesn't recognize is
 * left as a literal [bracketed] reminder so it's obvious it still needs
 * manual attention, rather than silently disappearing or breaking.
 */

import type { SectionInstance } from "./post-templates";

const ROLE_MENTION_RE = /<@&\d+>|@everyone|@here/;
const DIVIDER_RE = /^[━\-=_]{3,}$/;
// U+FE0F variation selector-16, built from its code point rather than
// embedded literally/escaped to avoid any source-encoding ambiguity.
const VARIATION_SELECTOR_16 = String.fromCharCode(0xfe0f);
// Matches a single leading emoji character (plus optional variation
// selector) at the start of a line, e.g. "🎉 **Title**" -> "🎉".
const EMOJI_LEAD_RE = new RegExp("^(\\p{Extended_Pictographic}" + VARIATION_SELECTOR_16 + "?)\\s*", "u");

// Label text (either the bracket's own contents, or a preceding **bold**
// label) that maps to a field the render data objects actually populate.
// Order matters only in that the first match wins.
const KNOWN_FIELD_SYNONYMS: [RegExp, string][] = [
  [/^event\s*name$/i, "title"],
  [/^event$/i, "title"],
  [/^title$/i, "title"],
  [/^day\s*date$/i, "dateStr"],
  [/^date$/i, "dateStr"],
  [/^time$/i, "timeStr"],
  [/^world$/i, "world"],
  [/^host$/i, "host_rsn"],
  [/^meet(ing)?( location)?$/i, "meet_location"],
  [/^spots?$/i, "spots"],
  [/sign-?up/i, "signup_type"],
  [/^voice$/i, "voice_channel"],
  [/prize|loot\s*split|^gp$/i, "prize_pool"],
  [/gear\s*req|^requirements?$/i, "requirements"],
  [/^guide$|^notes?$/i, "guide_text"],
  [/^video$/i, "video_url"],
  [/^description$/i, "description"],
  [/^author$/i, "author"],
];

function matchKnownField(label: string): string | null {
  const trimmed = label.trim();
  for (const [pattern, key] of KNOWN_FIELD_SYNONYMS) {
    if (pattern.test(trimmed)) return key;
  }
  return null;
}

function newInstanceId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `imp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Drop everything through the last "divider" line (a row of repeated ━/-/=/_), if any — that's almost always instructional preamble, not message content. */
function stripPreamble(text: string): string {
  const lines = text.split(/\r?\n/);
  let lastDivider = -1;
  lines.forEach((l, i) => {
    if (DIVIDER_RE.test(l.trim())) lastDivider = i;
  });
  return lastDivider === -1 ? text : lines.slice(lastDivider + 1).join("\n");
}

interface LineGroup {
  lines: string[];
  blankBefore: boolean;
}

/** Groups consecutive non-blank lines together; a blank line marks a gap before the next group. */
function splitIntoGroups(text: string): LineGroup[] {
  const rawLines = text.split(/\r?\n/);
  const groups: LineGroup[] = [];
  let current: string[] = [];
  let nextBlankBefore = false;

  const flush = () => {
    if (current.length > 0) {
      groups.push({ lines: current, blankBefore: nextBlankBefore });
      current = [];
      nextBlankBefore = false;
    }
  };

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) {
      flush();
      nextBlankBefore = true;
      continue;
    }
    current.push(line);
  }
  flush();
  return groups;
}

function extractLeadingEmoji(line: string): { emoji: string; rest: string } {
  const match = line.match(EMOJI_LEAD_RE);
  if (!match) return { emoji: "", rest: line };
  return { emoji: match[1].replace(VARIATION_SELECTOR_16, ""), rest: line.slice(match[0].length) };
}

/** Replaces [bracket] placeholders: known field labels become {field}, unknown ones are left literal. */
function substituteBrackets(text: string, requireKeys: string[]): string {
  return text.replace(/\[([^\]]+)\]/g, (full: string, inner: string, offset: number, str: string) => {
    if (/^emoji$/i.test(inner.trim())) return "{emoji}";

    const before = str.slice(0, offset);
    const labelMatch = before.match(/\*\*([^*]+)\*\*\s*:?\s*$/);
    const label = labelMatch ? labelMatch[1] : inner;

    const known = matchKnownField(label) ?? matchKnownField(inner);
    if (known) {
      if (!requireKeys.includes(known)) requireKeys.push(known);
      return `{${known}}`;
    }
    return full;
  });
}

function normalizeSpacing(text: string): string {
  return text.replace(/[ \t]+/g, " ").trim();
}

function buildLineInstance(rawLine: string, blankLineBefore: boolean): SectionInstance {
  const { emoji, rest } = extractLeadingEmoji(rawLine);
  const requireKeys: string[] = [];
  const substituted = substituteBrackets(rest, requireKeys);
  const template = normalizeSpacing(emoji ? `{emoji} ${substituted}` : substituted);

  return {
    instance_id: newInstanceId(),
    source_section_id: null,
    block_type: "line",
    label: normalizeSpacing(substituted.replace(/[*_`>]/g, "")).slice(0, 50) || "Imported Line",
    blankLineBefore,
    config: { emoji, template, requireKeys },
  };
}

function buildStaticTextInstance(lines: string[], blankLineBefore: boolean): SectionInstance {
  const joined = lines.join("\n");
  const { emoji, rest } = extractLeadingEmoji(joined);
  const requireKeys: string[] = [];
  const substituted = substituteBrackets(rest, requireKeys);
  const template = (emoji ? `{emoji} ${substituted}` : substituted).trim();

  return {
    instance_id: newInstanceId(),
    source_section_id: null,
    block_type: "static_text",
    label: normalizeSpacing(lines[0].replace(/[*_`>]/g, "")).slice(0, 50) || "Imported Text",
    blankLineBefore,
    config: { emoji, template },
  };
}

export function parseImportedTemplate(rawText: string): SectionInstance[] {
  const body = stripPreamble(rawText);
  const groups = splitIntoGroups(body);
  const instances: SectionInstance[] = [];
  let pingExtracted = false;

  for (const group of groups) {
    let lines = group.lines;

    if (!pingExtracted && lines.length > 0 && ROLE_MENTION_RE.test(lines[0])) {
      instances.push({
        instance_id: newInstanceId(),
        source_section_id: null,
        block_type: "role_ping_prefix",
        label: "Role Ping Prefix",
        blankLineBefore: false,
        config: {},
      });
      pingExtracted = true;
      lines = [lines[0].replace(ROLE_MENTION_RE, "").trim(), ...lines.slice(1)].filter(Boolean);
      if (lines.length === 0) continue;
    }

    const blankLineBefore = instances.length > 0 && group.blankBefore;

    instances.push(
      lines.length === 1 ? buildLineInstance(lines[0], blankLineBefore) : buildStaticTextInstance(lines, blankLineBefore)
    );
  }

  return instances;
}
