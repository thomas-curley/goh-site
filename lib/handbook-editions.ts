import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  HANDBOOK_BUCKET,
  HANDBOOK_MAX_PAGES,
  HANDBOOK_PATH_PATTERN,
  type HandbookContentsEntry,
  type HandbookEditionRow,
  type HandbookEditionView,
} from "@/lib/handbook-format";
import type { AccessLevel } from "@/lib/clan-access";

/** Signed page links last long enough for a long read; lazy-loaded pages further down still resolve. */
const SIGNED_URL_SECONDS = 6 * 60 * 60;

const ACCESS_LEVELS: AccessLevel[] = ["anonymous", "verified_player", "clan_member", "staff"];

export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Swaps an edition's storage paths for short-lived signed URLs. */
export async function signEdition(supabase: SupabaseClient, row: HandbookEditionRow): Promise<HandbookEditionView> {
  const { page_paths, pdf_path, ...rest } = row;
  const paths = pdf_path ? [...page_paths, pdf_path] : page_paths;
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from(HANDBOOK_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }
  return {
    ...rest,
    page_urls: page_paths.map((p) => signed.get(p) ?? ""),
    pdf_url: pdf_path ? signed.get(pdf_path) ?? null : null,
  };
}

export type EditionSummary = Pick<HandbookEditionRow, "id" | "title" | "version_label" | "notes" | "published_at">;

/** Every published edition, newest first -- the first is the current handbook. */
export async function getPublishedEditions(supabase: SupabaseClient): Promise<EditionSummary[]> {
  const { data } = await supabase
    .from("handbook_editions")
    .select("id, title, version_label, notes, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  return (data as EditionSummary[] | null) ?? [];
}

/** A published edition by id (unsigned -- sign it only after the viewer passes the visibility check). */
export async function getPublishedEdition(supabase: SupabaseClient, id: string): Promise<HandbookEditionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("handbook_editions").select("*").eq("id", id).eq("is_published", true).maybeSingle();
  return (data as HandbookEditionRow | null) ?? null;
}

function parseContents(value: unknown, pageCount: number): HandbookContentsEntry[] | { error: string } {
  if (!Array.isArray(value)) return [];
  const entries: HandbookContentsEntry[] = [];
  for (const raw of value) {
    const title = typeof raw?.title === "string" ? raw.title.trim().slice(0, 120) : "";
    const page = Number(raw?.page);
    if (!title) continue;
    if (!Number.isInteger(page) || page < 1 || (pageCount > 0 && page > pageCount)) {
      return { error: `"${title}" points at page ${raw?.page}, but the handbook has ${pageCount} page${pageCount === 1 ? "" : "s"}.` };
    }
    entries.push({ title, page });
  }
  return entries.sort((a, b) => a.page - b.page);
}

/**
 * Validates the editable fields of an edition from a request body. With
 * `partial`, absent fields are left out (for PATCH). `currentPageCount` is
 * used to check contents entries when the pages themselves aren't changing.
 */
export function parseEditionBody(
  body: Record<string, unknown>,
  partial: boolean,
  currentPageCount = 0
): { update: Record<string, unknown> } | { error: string } {
  const update: Record<string, unknown> = {};

  if (body.title !== undefined || !partial) {
    update.title = (typeof body.title === "string" ? body.title.trim().slice(0, 100) : "") || "Staff Handbook";
  }
  if (body.versionLabel !== undefined) {
    update.version_label = typeof body.versionLabel === "string" ? body.versionLabel.trim().slice(0, 60) || null : null;
  }
  if (body.notes !== undefined) {
    update.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null;
  }
  if (body.pagePaths !== undefined || !partial) {
    const pages = Array.isArray(body.pagePaths) ? body.pagePaths : [];
    if (!pages.every((p) => typeof p === "string" && HANDBOOK_PATH_PATTERN.test(p) && p.startsWith("pages/"))) {
      return { error: "Pages must be uploaded through this page." };
    }
    if (pages.length > HANDBOOK_MAX_PAGES) return { error: `The handbook can have at most ${HANDBOOK_MAX_PAGES} pages.` };
    update.page_paths = pages;
  }
  if (body.pdfPath !== undefined) {
    const p = body.pdfPath;
    if (p !== null && p !== "" && !(typeof p === "string" && HANDBOOK_PATH_PATTERN.test(p) && p.startsWith("pdf/"))) {
      return { error: "The PDF must be uploaded through this page." };
    }
    update.pdf_path = p || null;
  }
  if (body.contents !== undefined) {
    const pageCount = Array.isArray(update.page_paths) ? update.page_paths.length : currentPageCount;
    const contents = parseContents(body.contents, pageCount);
    if ("error" in contents) return contents;
    update.contents = contents;
  }
  if (body.visibility !== undefined || !partial) {
    const v = body.visibility ?? "staff";
    if (!ACCESS_LEVELS.includes(v as AccessLevel)) return { error: "Pick who can read the handbook." };
    update.visibility = v;
  }
  if (body.isPublished !== undefined) update.is_published = body.isPublished === true;

  return { update };
}
