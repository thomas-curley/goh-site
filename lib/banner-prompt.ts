/**
 * Builds a DALL-E 3 prompt for generating an event or announcement banner.
 * Uses OSRS/fantasy aesthetic with the Gn0me Home gnome woodland theme.
 */

interface BannerContext {
  title: string;
  description?: string;
  eventType?: string;
  type: "event" | "announcement";
}

const EVENT_TYPE_SCENES: Record<string, string> = {
  pvm: "an epic boss fight scene with warriors battling a massive monster in a dark dungeon, dramatic lighting, spell effects flying",
  skilling: "a peaceful skilling scene with players mining, fishing, or woodcutting in a lush forest clearing, warm golden light",
  drop_party: "a festive celebration scene with treasure chests overflowing with gold coins and rare items, confetti and sparkles, party atmosphere",
  hide_seek: "a whimsical hide and seek game in a magical gnome village, players hiding behind mushroom houses and trees",
  social: "a cozy tavern gathering scene with adventurers sitting around a warm fireplace, mugs raised, friendly atmosphere",
  other: "an adventurous fantasy scene with a group of heroes standing on a hilltop overlooking a vast medieval landscape",
};

export function buildBannerPrompt(context: BannerContext): string {
  const scene = context.eventType
    ? EVENT_TYPE_SCENES[context.eventType] ?? EVENT_TYPE_SCENES.other
    : EVENT_TYPE_SCENES.other;

  const titleText = context.title.length <= 30 ? context.title : "";

  const basePrompt = [
    `A wide cinematic banner image in Old School RuneScape pixel-inspired fantasy art style.`,
    `The scene shows ${scene}.`,
    context.description
      ? `The theme is: ${context.description.slice(0, 100)}.`
      : "",
    `The color palette uses earthy greens, dark wood browns, parchment golds, and gnome village woodland tones.`,
    titleText
      ? `The text "${titleText}" is displayed prominently in a medieval fantasy font at the center, with a slight golden glow.`
      : "",
    `The image has a 16:9 aspect ratio, suitable for a website banner or Discord embed.`,
    `Style: fantasy game art, warm lighting, rich colors, slightly stylized, no modern elements.`,
  ]
    .filter(Boolean)
    .join(" ");

  return basePrompt;
}
