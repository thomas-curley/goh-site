import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { getServiceClient, isOwnStorageUrl } from "@/lib/newsletter-admin";
import { CLAN_PAGE_MAX_PAGES, isClanPageSlug } from "@/lib/clan-pages-format";

// PUT - replace a page's uploads. An empty page list goes back to the
// built-in fallback (the About page's rank list / the handbook's rules).
export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { allowed, user } = await checkPermission("manage_clan_pages");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { slug } = await params;
  if (!isClanPageSlug(slug)) return NextResponse.json({ error: "Unknown page." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const pageUrls = Array.isArray(body.pageUrls) ? body.pageUrls : [];
  if (!pageUrls.every(isOwnStorageUrl)) return NextResponse.json({ error: "Pages must be uploaded through this page." }, { status: 400 });
  if (pageUrls.length > CLAN_PAGE_MAX_PAGES) return NextResponse.json({ error: `A page can have at most ${CLAN_PAGE_MAX_PAGES} images.` }, { status: 400 });
  const pdfUrl = body.pdfUrl ? body.pdfUrl : null;
  if (pdfUrl !== null && !isOwnStorageUrl(pdfUrl)) return NextResponse.json({ error: "The PDF must be uploaded through this page." }, { status: 400 });

  const { error } = await supabase.from("clan_pages").upsert({
    slug,
    page_urls: pageUrls,
    pdf_url: pageUrls.length > 0 ? pdfUrl : null,
    updated_by: user?.discord_username ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: "Failed to save the page." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
