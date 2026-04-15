"use client";

import { useState } from "react";

interface EmojiConfigProps {
  emojis: Record<string, string>;
  onChange: (emojis: Record<string, string>) => void;
  fields: { key: string; label: string; default: string }[];
}

const COMMON_EMOJIS = [
  "📢", "🏰", "⚔️", "🗡️", "🛡️", "🏹", "🧙", "💰", "🎯", "🏆",
  "🔥", "⭐", "🎉", "🎆", "📋", "📅", "⏰", "🌍", "📍", "👥",
  "📝", "🔊", "🤠", "🥇", "🥈", "🥉", "🎖️", "💎", "🌳", "🍄",
  "✅", "❌", "⚡", "💀", "👑", "🎮", "🎲", "📸", "🔄", "🏠",
];

export function EmojiConfig({ emojis, onChange, fields }: EmojiConfigProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  const updateEmoji = (key: string, emoji: string) => {
    onChange({ ...emojis, [key]: emoji });
    setEditingField(null);
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-bark-brown mb-2">
        Customize Emojis
      </label>
      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingField(editingField === field.key ? null : field.key)}
              className="w-8 h-8 rounded-md border border-bark-brown-light flex items-center justify-center text-lg hover:border-gnome-green cursor-pointer transition-colors"
              title={`Change ${field.label} emoji`}
            >
              {emojis[field.key] ?? field.default}
            </button>
            <span className="text-sm text-bark-brown-light">{field.label}</span>

            {editingField === field.key && (
              <div className="flex flex-wrap gap-1 ml-2 p-2 rounded-md border border-bark-brown-light bg-parchment-dark max-w-xs">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => updateEmoji(field.key, emoji)}
                    className="w-7 h-7 rounded hover:bg-gnome-green/20 flex items-center justify-center cursor-pointer text-sm"
                  >
                    {emoji}
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="Custom"
                  maxLength={4}
                  className="w-14 px-1 py-0.5 text-center text-sm rounded border border-bark-brown-light bg-parchment"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateEmoji(field.key, (e.target as HTMLInputElement).value);
                    }
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Get emoji for a field, falling back to default */
export function getEmoji(emojis: Record<string, string>, key: string, defaultEmoji: string): string {
  return emojis[key] ?? defaultEmoji;
}
