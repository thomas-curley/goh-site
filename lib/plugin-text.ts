/**
 * Plain-text scrubber for anything the RuneLite plugin displays. Site
 * content is authored for Discord -- **bold**, :shortcode: emoji, custom
 * <:emote:id> tags, <@&role> pings, and raw unicode emoji -- none of which
 * a Swing label renders (emoji show as boxes, the rest shows literally).
 * Applied server-side in the plugin's API routes so the plugin never has to
 * know about Discord markdown at all.
 *
 * Deliberately NOT applied to the in-game event translation values
 * (/api/plugin/admin/ingame-events): those are typed into OSRS's own form
 * and must match what the admin entered exactly.
 */

const CUSTOM_EMOTE = /<a?:\w+:\d+>/g;
const MENTION = /<@[!&]?\d+>|<#\d+>/g;
const SHORTCODE = /:[a-z0-9_+-]+:/gi;
const MARKDOWN = /(\*\*|__|~~|`)/g;
// Unicode emoji: pictographs plus the joiners/modifiers that ride along
// with them (variation selectors, zero-width joiners, skin tones, keycaps).
const UNICODE_EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Modifier}|️|‍|⃣/gu;

export function pluginPlainText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(CUSTOM_EMOTE, "")
    .replace(MENTION, "")
    .replace(SHORTCODE, "")
    .replace(MARKDOWN, "")
    .replace(UNICODE_EMOJI, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same scrub, but keeps null for absent values so optional fields stay optional. */
export function pluginPlainTextOrNull(value: string | null | undefined): string | null {
  const cleaned = pluginPlainText(value);
  return cleaned || null;
}
