"use client";

// Per-browser state for the staff "What's New" page: which entries this
// person has seen, and where they are in the page-to-page walkthrough.
// Stored in localStorage (a convenience -- clearing it just shows everything
// as new again), and announced with a window event so the walkthrough bar,
// the user menu dot and the page stay in sync without a reload.

import { WHATS_NEW, type WhatsNewEntry } from "@/content/whats-new";

const SEEN_KEY = "whats-new-seen";
const WALKTHROUGH_KEY = "whats-new-walkthrough";
export const WHATS_NEW_EVENT = "whats-new-change";

export interface WalkthroughState {
  ids: string[];
  index: number;
  collapsed?: boolean;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode) -- state just won't persist.
  }
  window.dispatchEvent(new Event(WHATS_NEW_EVENT));
}

export function getSeenIds(): Set<string> {
  return new Set(read<string[]>(SEEN_KEY, []));
}

export function markSeen(ids: string[]) {
  const seen = getSeenIds();
  for (const id of ids) seen.add(id);
  write(SEEN_KEY, [...seen]);
}

export function unseenCount(): number {
  const seen = getSeenIds();
  return WHATS_NEW.filter((e) => !seen.has(e.id)).length;
}

export function getWalkthrough(): WalkthroughState | null {
  const state = read<WalkthroughState | null>(WALKTHROUGH_KEY, null);
  if (!state || !Array.isArray(state.ids) || state.ids.length === 0) return null;
  // Drop ids for entries that no longer exist.
  const ids = state.ids.filter((id) => WHATS_NEW.some((e) => e.id === id));
  if (ids.length === 0) return null;
  return { ...state, ids, index: Math.min(Math.max(0, state.index), ids.length - 1) };
}

export function setWalkthrough(state: WalkthroughState | null) {
  write(WALKTHROUGH_KEY, state);
}

export function walkthroughEntry(state: WalkthroughState): WhatsNewEntry | undefined {
  return WHATS_NEW.find((e) => e.id === state.ids[state.index]);
}
