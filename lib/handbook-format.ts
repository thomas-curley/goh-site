// Shared (client + server) shapes for Staff Handbook editions. Files live
// in a private bucket, so rows carry storage paths and the server swaps
// them for short-lived signed URLs before anything reaches a browser.

import type { AccessLevel } from "@/lib/clan-access";

export const HANDBOOK_BUCKET = "handbook";
export const HANDBOOK_MAX_PAGES = 80;

export interface HandbookContentsEntry {
  title: string;
  /** 1-based page number. */
  page: number;
}

export interface HandbookEditionRow {
  id: string;
  title: string;
  version_label: string | null;
  notes: string | null;
  page_paths: string[];
  pdf_path: string | null;
  contents: HandbookContentsEntry[];
  visibility: AccessLevel;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** An edition ready to show: signed URLs instead of storage paths. */
export interface HandbookEditionView extends Omit<HandbookEditionRow, "page_paths" | "pdf_path"> {
  page_urls: string[];
  pdf_url: string | null;
}

/** Storage paths this app writes: pages/<id>.<ext> or pdf/<id>.pdf. */
export const HANDBOOK_PATH_PATTERN = /^(pages\/[a-z0-9_-]+\.(png|jpe?g|webp)|pdf\/[a-z0-9_-]+\.pdf)$/;

export function formatEditionDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function editionLabel(e: Pick<HandbookEditionRow, "title" | "version_label">): string {
  return e.version_label ? `${e.title} · ${e.version_label}` : e.title;
}
