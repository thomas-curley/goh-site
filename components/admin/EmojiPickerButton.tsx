"use client";

import { useState, useEffect, useRef } from "react";

interface GuildEmoji {
  id: string;
  name: string;
  animated: boolean;
}

// Curated common set (revived from the old, since-removed EmojiConfig) --
// plain Unicode, so these need no resolution and just insert as-is.
const COMMON_EMOJIS = [
  "📢", "🏰", "⚔️", "🗡️", "🛡️", "🏆", "🥇", "🥈", "🥉", "🎉",
  "🎊", "🔥", "💰", "💎", "⭐", "✅", "❌", "📅", "⏰", "📍",
  "🌍", "🎤", "🎮", "🌿", "🎯",
];

/**
 * A small button that opens a panel of server custom emotes + common
 * Unicode emoji. Clicking one calls onInsert with either `:name:` shorthand
 * (server emotes -- resolved to real <:name:id> syntax by lib/discord.ts at
 * post time) or the raw character (Unicode, already valid as-is). Callers
 * own the field's value and typically append: onInsert={(t) =>
 * setValue((prev) => prev + (prev ? " " : "") + t)}.
 */
export function EmojiPickerButton({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"server" | "common">("server");
  const [serverEmojis, setServerEmojis] = useState<GuildEmoji[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleOpen = () => {
    setOpen((prev) => !prev);
    if (!loaded) {
      setLoading(true);
      fetch("/api/discord/emojis")
        .then((res) => res.json())
        .then((data) => setServerEmojis(Array.isArray(data.emojis) ? data.emojis : []))
        .catch(() => setServerEmojis([]))
        .finally(() => {
          setLoading(false);
          setLoaded(true);
        });
    }
  };

  const insertServer = (emoji: GuildEmoji) => {
    onInsert(`:${emoji.name}:`);
    setOpen(false);
  };

  const insertCommon = (char: string) => {
    onInsert(char);
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        title="Insert emote"
        className="px-2 py-1 rounded-md text-sm border border-bark-brown-light bg-parchment hover:bg-parchment-dark transition-colors cursor-pointer"
      >
        😀
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-64 card-wood py-2 z-50 shadow-xl">
          <div className="flex gap-1 px-2 mb-2">
            <button
              type="button"
              onClick={() => setTab("server")}
              className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors cursor-pointer ${tab === "server" ? "bg-gnome-green text-text-light" : "text-bark-brown hover:bg-parchment-dark"}`}
            >
              Server Emotes
            </button>
            <button
              type="button"
              onClick={() => setTab("common")}
              className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors cursor-pointer ${tab === "common" ? "bg-gnome-green text-text-light" : "text-bark-brown hover:bg-parchment-dark"}`}
            >
              Common
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto px-2">
            {tab === "server" ? (
              loading ? (
                <p className="text-xs text-iron-grey px-1 py-2">Loading...</p>
              ) : serverEmojis.length === 0 ? (
                <p className="text-xs text-iron-grey px-1 py-2">No server emotes found.</p>
              ) : (
                <div className="grid grid-cols-1 gap-0.5">
                  {serverEmojis.map((emoji) => (
                    <button
                      key={emoji.id}
                      type="button"
                      onClick={() => insertServer(emoji)}
                      className="flex items-center gap-2 px-2 py-1 rounded-md text-sm text-bark-brown hover:bg-parchment-dark transition-colors cursor-pointer text-left"
                    >
                      <img
                        src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}`}
                        alt={emoji.name}
                        className="w-5 h-5"
                      />
                      <span className="truncate">{emoji.name}</span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-6 gap-1">
                {COMMON_EMOJIS.map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => insertCommon(char)}
                    className="text-lg p-1 rounded-md hover:bg-parchment-dark transition-colors cursor-pointer"
                  >
                    {char}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
