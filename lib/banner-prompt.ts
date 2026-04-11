/**
 * Builds a DALL-E 3 prompt for generating an event or announcement banner.
 * Uses OSRS/fantasy aesthetic with the Gn0me Home gnome woodland theme.
 *
 * The prompt is designed for 1792x1024 (1.75:1 wide landscape) which is
 * DALL-E 3's widest option. Composition instructions ensure the scene
 * fills the full width without important elements getting cropped.
 */

interface BannerContext {
  title: string;
  description?: string;
  eventType?: string;
  type: "event" | "announcement";
}

const EVENT_TYPE_SCENES: Record<string, string> = {
  pvm: "an epic boss fight scene with warriors battling a massive monster in a dark dungeon, dramatic lighting, spell effects flying across the width of the image",
  skilling: "a panoramic peaceful skilling scene with players mining, fishing, or woodcutting across a wide lush forest clearing, warm golden light spreading from left to right",
  drop_party: "a wide festive celebration scene with treasure chests overflowing with gold coins and rare items spread across the full width, confetti and sparkles filling the sky, party atmosphere",
  hide_seek: "a wide panoramic view of a magical gnome village with players hiding behind mushroom houses and trees scattered across the scene from edge to edge",
  social: "a wide cozy tavern interior scene with adventurers gathered around a long table spanning the image, warm fireplace on one side, mugs raised, friendly atmosphere",
  other: "a wide panoramic fantasy landscape with a group of heroes standing on a hilltop, vast medieval kingdom stretching to the horizon on both sides",
};

export function buildBannerPrompt(context: BannerContext): string {
  const scene = context.eventType
    ? EVENT_TYPE_SCENES[context.eventType] ?? EVENT_TYPE_SCENES.other
    : EVENT_TYPE_SCENES.other;

  const basePrompt = [
    // Resolution and composition guidance
    `Create a wide panoramic landscape banner illustration at exactly 1792x1024 pixels.`,
    `The composition must be designed for this ultra-wide format — spread the scene horizontally across the entire canvas with no dead space on the sides.`,
    `Do not center a small subject in the middle with empty margins. Fill the full width with the scene.`,

    // Scene
    `The scene shows ${scene}.`,
    context.description
      ? `The theme is: ${context.description.slice(0, 150)}.`
      : "",

    // Style
    `Art style: Old School RuneScape pixel-inspired fantasy game art with warm lighting, rich saturated colors, and a slightly stylized painterly feel. No modern elements, no photographs, no 3D renders.`,
    `Color palette: earthy forest greens, dark wood browns, parchment golds, and warm amber tones — the "Gnome Village" woodland aesthetic.`,

    // No text in image — will be overlaid via CSS
    `CRITICAL: Do NOT include any text, words, letters, numbers, signs, banners with writing, or typography anywhere in the image. The image must be purely visual art with zero text of any kind. Leave the upper portion of the image slightly darker or with negative space so text can be overlaid on top later.`,

    // Composition reminders
    `Important: the image is wide landscape format (1.75:1 ratio). Compose the scene to span the full width. Place visual interest across the entire horizontal span, not just the center.`,
  ]
    .filter(Boolean)
    .join(" ");

  return basePrompt;
}
