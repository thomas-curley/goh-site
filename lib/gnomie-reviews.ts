export interface HighlightType {
  key: string;
  label: string;
  emoji: string;
}

export const HIGHLIGHT_TYPES: HighlightType[] = [
  { key: "shoutout", label: "Shoutout", emoji: "📣" },
  { key: "helped_me_out", label: "Helped Me Out", emoji: "🤝" },
  { key: "funny_moment", label: "Funny Moment", emoji: "😂" },
  { key: "mvp", label: "MVP", emoji: "🏆" },
];

export const HIGHLIGHT_TYPE_KEYS = HIGHLIGHT_TYPES.map((t) => t.key);

export function highlightTypeLabel(key: string): HighlightType {
  return HIGHLIGHT_TYPES.find((t) => t.key === key) ?? HIGHLIGHT_TYPES[0];
}
