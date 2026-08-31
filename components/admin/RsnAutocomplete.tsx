"use client";

import { useState, useMemo } from "react";

// Local copy rather than importing lib/wom.ts's normalizeRsn -- that file
// instantiates a WOMClient at module scope, which isn't worth pulling into
// a client bundle just for this one pure string function (lib/clan-access.ts
// keeps its own copy for the same reason).
function normalizeRsn(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

interface RsnAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  roster: string[];
  linkedRsns: Set<string>; // already normalized
  placeholder?: string;
  className?: string;
}

/**
 * RSN text input with roster suggestions (shows the full clan roster on
 * focus, filters as you type -- same pattern as GnomieReviewForm/Bingo's
 * team picker) plus a small live indicator for whether the typed name
 * currently resolves to a verified linked account. Free text is still
 * accepted and submittable either way -- someone not linked yet is a valid,
 * expected case, not an error.
 */
export function RsnAutocomplete({ value, onChange, roster, linkedRsns, placeholder = "RSN", className }: RsnAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const matches = q ? roster.filter((name) => name.toLowerCase().includes(q)) : roster;
    return matches.slice(0, 20);
  }, [value, roster]);

  const isLinked = !!value.trim() && linkedRsns.has(normalizeRsn(value));

  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className={`${className ?? ""} pr-7`}
      />
      {value.trim() && (
        <span
          className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${isLinked ? "text-gnome-green" : "text-iron-grey/50"}`}
          title={isLinked ? "Linked account -- can notify" : "No linked account -- can still add manually"}
        >
          {isLinked ? "✓" : "○"}
        </span>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 card-wood py-1 z-10 shadow-xl max-h-48 overflow-y-auto">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onMouseDown={() => { onChange(name); setShowSuggestions(false); }}
              className="w-full text-left px-3 py-1.5 text-sm font-mono text-bark-brown hover:bg-parchment-dark transition-colors cursor-pointer flex items-center justify-between gap-2"
            >
              <span className="truncate">{name}</span>
              {linkedRsns.has(normalizeRsn(name)) && <span className="text-xs text-gnome-green shrink-0">✓ linked</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
