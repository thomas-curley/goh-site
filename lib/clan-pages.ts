import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { ClanPage, ClanPageSlug } from "@/lib/clan-pages-format";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

/** A page's uploads, or null when nothing has been uploaded yet (the page then shows its built-in fallback). */
export async function getClanPage(slug: ClanPageSlug): Promise<ClanPage | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data } = await supabase.from("clan_pages").select("*").eq("slug", slug).maybeSingle();
  const page = data as ClanPage | null;
  return page && page.page_urls.length > 0 ? page : null;
}

export interface RulesSection {
  title: string;
  content: string;
}

/**
 * The clan rules as written in the old text handbook ("Appendix A: Clan
 * Rules" and its subsections) -- shown on /clan-rules until rule pages are
 * uploaded.
 */
export async function getLegacyClanRules(): Promise<{ intro: string; sections: RulesSection[] }> {
  const supabase = getServiceClient();
  if (!supabase) return { intro: "", sections: [] };
  const { data } = await supabase
    .from("handbook_sections")
    .select("slug, title, parent_slug, order_index, content")
    .or("slug.eq.appendix-clan-rules,parent_slug.eq.appendix-clan-rules")
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  const rows = (data ?? []) as { slug: string; title: string; parent_slug: string | null; content: string }[];
  // The handbook intro lists links to each rule's own (staff-only) handbook
  // page; here every section follows on the same page, so drop that list.
  const intro = (rows.find((r) => r.slug === "appendix-clan-rules")?.content ?? "")
    .split("\n")
    .filter((line) => !/^\s*-\s*\[[^\]]+\]\(\/staff-handbook\/[^)]+\)\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return {
    intro,
    sections: rows.filter((r) => r.parent_slug === "appendix-clan-rules").map((r) => ({ title: r.title, content: r.content })),
  };
}
