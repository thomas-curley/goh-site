import type { ClanPage } from "@/lib/clan-pages-format";
import { UploadedPages } from "@/components/clan/UploadedPages";

function formatUpdated(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Layout shared by /rank-structure and /clan-rules: the heading, then the
 * uploaded pages when there are any, otherwise the page's built-in fallback.
 */
export function ClanPageShell({
  title,
  intro,
  page,
  fallback,
}: {
  title: string;
  intro: string;
  page: ClanPage | null;
  fallback: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-6 py-8 sm:py-12">
      <header className="text-center mb-6">
        <h1 className="font-display text-3xl sm:text-4xl text-gnome-green">{title}</h1>
        <p className="text-bark-brown-light mt-2 max-w-2xl mx-auto">{intro}</p>
        {page && (
          <p className="text-xs text-iron-grey mt-2">
            Updated {formatUpdated(page.updated_at)}
            {page.pdf_url && (
              <>
                {" · "}
                <a href={page.pdf_url} target="_blank" rel="noreferrer" className="text-gnome-green hover:underline">Download PDF</a>
              </>
            )}
          </p>
        )}
      </header>
      {page ? <UploadedPages title={title} pageUrls={page.page_urls} /> : fallback}
    </div>
  );
}
