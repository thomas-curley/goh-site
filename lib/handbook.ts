import { createClient } from "@supabase/supabase-js";
import type { AccessLevel } from "@/lib/clan-access";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface HandbookSection {
  id: string;
  slug: string;
  title: string;
  parent_slug: string | null;
  order_index: number;
  pull_quote: string | null;
  content: string;
  visibility: AccessLevel;
  is_published: boolean;
}

export interface HandbookNode extends HandbookSection {
  children: HandbookNode[];
}

/** Published sections nested by parent_slug, top-level first, each ordered by order_index. Used by the public index + sidebar. */
export async function getHandbookTree(): Promise<HandbookNode[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("handbook_sections")
    .select("*")
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (error || !data) return [];

  const sections = data as HandbookSection[];
  const bySlug = new Map<string, HandbookNode>(sections.map((s) => [s.slug, { ...s, children: [] }]));
  const roots: HandbookNode[] = [];

  for (const s of sections) {
    const node = bySlug.get(s.slug)!;
    const parent = s.parent_slug ? bySlug.get(s.parent_slug) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

/** Walks a tree into the flat root-then-children-then-next-root order used for the sidebar list and prev/next links. */
export function flattenHandbookTree(tree: HandbookNode[]): HandbookNode[] {
  const flat: HandbookNode[] = [];
  for (const node of tree) {
    flat.push(node);
    flat.push(...flattenHandbookTree(node.children));
  }
  return flat;
}

/** A single published section by slug, for the public section page (regardless of visibility -- the page itself runs the eligibility gate). */
export async function getHandbookSection(slug: string): Promise<HandbookSection | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("handbook_sections")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  return (data as HandbookSection) ?? null;
}
