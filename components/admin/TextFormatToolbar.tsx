"use client";

import { useState, useEffect, useRef, type RefObject } from "react";

type FieldRef = RefObject<HTMLTextAreaElement | HTMLInputElement | null>;

/**
 * Small toolbar of Bold / Italic / Link buttons for a textarea or input,
 * so admins don't need to remember Discord's markdown syntax by hand.
 * Needs a ref to the field (not just value/onChange) to read the current
 * text selection -- wrapping only the selected text, or inserting at the
 * cursor when nothing is selected.
 */
export function TextFormatToolbar({ value, onChange, targetRef }: { value: string; onChange: (v: string) => void; targetRef: FieldRef }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setLinkOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const getSelection = () => {
    const el = targetRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    return { start, end };
  };

  const focusAndSelect = (from: number, to: number) => {
    requestAnimationFrame(() => {
      const el = targetRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(from, to);
    });
  };

  const wrapSelection = (marker: string) => {
    const { start, end } = getSelection();
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
    onChange(next);
    const cursorStart = start + marker.length;
    focusAndSelect(cursorStart, cursorStart + selected.length);
  };

  const openLinkPopover = () => {
    setLinkUrl("");
    setLinkOpen(true);
  };

  const insertLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const { start, end } = getSelection();
    const selected = value.slice(start, end) || "link text";
    const snippet = `[${selected}](${url})`;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    setLinkOpen(false);
    const cursor = start + snippet.length;
    focusAndSelect(cursor, cursor);
  };

  const buttonClass = "px-2 py-1 rounded-md text-sm border border-bark-brown-light bg-parchment hover:bg-parchment-dark transition-colors cursor-pointer";

  return (
    <div className="relative inline-flex items-center gap-1" ref={popoverRef}>
      <button type="button" onClick={() => wrapSelection("**")} title="Bold" className={`${buttonClass} font-bold`}>B</button>
      <button type="button" onClick={() => wrapSelection("*")} title="Italic" className={`${buttonClass} italic`}>I</button>
      <button type="button" onClick={openLinkPopover} title="Insert link" className={buttonClass}>🔗</button>

      {linkOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 card-wood p-2 z-50 shadow-xl">
          <label className="block text-xs font-semibold text-bark-brown mb-1">Link URL</label>
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); insertLink(); }
              if (e.key === "Escape") setLinkOpen(false);
            }}
            autoFocus
            placeholder="https://..."
            className="w-full px-2 py-1 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green mb-2"
          />
          <p className="text-[11px] text-iron-grey mb-2">Wraps your selected text, or inserts "link text" if nothing's selected.</p>
          <button type="button" onClick={insertLink} disabled={!linkUrl.trim()} className="w-full text-xs px-2 py-1 rounded-md bg-gnome-green text-text-light hover:bg-gnome-green-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            Insert
          </button>
        </div>
      )}
    </div>
  );
}
