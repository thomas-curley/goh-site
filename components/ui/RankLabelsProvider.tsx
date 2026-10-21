"use client";

import { createContext, useContext } from "react";
import { getRankByName } from "@/lib/constants";
import type { RankLabels } from "@/lib/rank-labels";

const RankLabelsContext = createContext<RankLabels>({});

/** Shares the clan's custom rank names (Admin › Rank Labels) with every page. Loaded once in the root layout. */
export function RankLabelsProvider({ labels, children }: { labels: RankLabels; children: React.ReactNode }) {
  return <RankLabelsContext.Provider value={labels}>{children}</RankLabelsContext.Provider>;
}

/**
 * Display helpers for ranks: `name("deputy_owner")` -> the custom label for
 * Silver Key, or "Silver Key" if none is set. Accepts rank keys, rank names
 * or Wise Old Man roles.
 */
export function useRankLabels() {
  const labels = useContext(RankLabelsContext);
  return {
    name: (rank: string | null | undefined, fallback?: string): string => {
      if (!rank) return fallback ?? "";
      const def = getRankByName(rank);
      return (def && labels[def.key]?.label) || def?.name || fallback || rank.replace(/_/g, " ");
    },
    description: (rankKey: string): string => {
      const def = getRankByName(rankKey);
      return (def && labels[def.key]?.description) || def?.description || "";
    },
  };
}
