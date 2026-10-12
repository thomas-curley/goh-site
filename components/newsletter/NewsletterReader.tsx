import Link from "next/link";
import { CopyLinkButton } from "@/components/newsletter/CopyLinkButton";
import { formatIssueDate, type Newsletter, type NewsletterSummary } from "@/lib/newsletter-format";

const pill =
  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-bark-brown-light/60 bg-parchment text-sm text-bark-brown hover:bg-parchment-dark hover:text-gnome-green transition-colors cursor-pointer";

function IssueNav({ newer, older }: { newer: NewsletterSummary | null; older: NewsletterSummary | null }) {
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Other issues">
      {older ? (
        <Link href={`/newsletter/${older.issue_number}`} className={pill}>← Issue {older.issue_number}</Link>
      ) : (
        <span />
      )}
      {newer ? (
        <Link href={`/newsletter/${newer.issue_number}`} className={pill}>Issue {newer.issue_number} →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/**
 * One issue of The Weekly Glider: its pages stacked full-width (each opens
 * full-size in a new tab, for pinch-zooming on a phone), links to the
 * neighbouring issues, and the archive of every published issue below.
 */
export function NewsletterReader({ issue, archive }: { issue: Newsletter; archive: NewsletterSummary[] }) {
  const index = archive.findIndex((a) => a.issue_number === issue.issue_number);
  const newer = index > 0 ? archive[index - 1] : null;
  const older = index >= 0 && index < archive.length - 1 ? archive[index + 1] : null;
  const isLatest = index === 0;
  const pageCount = issue.page_urls.length;

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-6 py-6 sm:py-10">
      <header className="text-center mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-iron-grey">
          {issue.title}
          {isLatest && <span className="ml-2 px-2 py-0.5 rounded-full bg-gnome-green/15 text-gnome-green normal-case tracking-normal">Latest issue</span>}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-gnome-green mt-1">Issue No. {issue.issue_number}</h1>
        <p className="text-sm text-bark-brown-light mt-1">{formatIssueDate(issue.published_on)}</p>
        {issue.headline && <p className="mt-2 italic text-bark-brown">{issue.headline}</p>}
      </header>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
        {pageCount > 1 &&
          issue.page_urls.map((_, i) => (
            <a key={i} href={`#page-${i + 1}`} className={pill}>Page {i + 1}</a>
          ))}
        {issue.pdf_url && (
          <a href={issue.pdf_url} target="_blank" rel="noreferrer" className={pill}>📄 PDF</a>
        )}
        <CopyLinkButton path={`/newsletter/${issue.issue_number}`} className={pill} />
      </div>

      <div className="space-y-6">
        {issue.page_urls.map((url, i) => (
          <figure key={url} id={`page-${i + 1}`} className="scroll-mt-20">
            <a href={url} target="_blank" rel="noreferrer" className="block cursor-zoom-in" title="Open full size">
              {/* Plain <img>: these are full-page scans of unknown size, served straight from storage. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${issue.title}, Issue No. ${issue.issue_number}, page ${i + 1} of ${pageCount}`}
                loading={i === 0 ? "eager" : "lazy"}
                className="w-full h-auto rounded-md border border-bark-brown-light/40 shadow-md bg-white"
              />
            </a>
            <figcaption className="mt-2 text-center text-xs text-iron-grey">
              {pageCount > 1 ? `Page ${i + 1} of ${pageCount} · ` : ""}Tap to open full size
            </figcaption>
          </figure>
        ))}
      </div>

      {(newer || older) && (
        <div className="mt-8">
          <IssueNav newer={newer} older={older} />
        </div>
      )}

      {archive.length > 1 && (
        <section className="mt-12 pt-8 border-t border-bark-brown-light/40" aria-labelledby="archive-heading">
          <h2 id="archive-heading" className="font-display text-2xl text-bark-brown mb-4">All Issues</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {archive.map((a) => {
              const current = a.issue_number === issue.issue_number;
              return (
                <li key={a.id}>
                  <Link
                    href={`/newsletter/${a.issue_number}`}
                    aria-current={current ? "page" : undefined}
                    className={`group block rounded-md border bg-parchment overflow-hidden transition-shadow hover:shadow-md ${current ? "border-gnome-green ring-2 ring-gnome-green/40" : "border-bark-brown-light/40"}`}
                  >
                    {a.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.cover_url} alt="" loading="lazy" className="w-full aspect-[3/4] object-cover object-top bg-white" />
                    ) : (
                      <div className="w-full aspect-[3/4] bg-parchment-dark/40" />
                    )}
                    <div className="p-2">
                      <p className="text-sm font-semibold text-bark-brown group-hover:text-gnome-green">
                        Issue No. {a.issue_number}
                        {current && <span className="ml-1 text-xs font-normal text-gnome-green">· reading</span>}
                      </p>
                      <p className="text-xs text-iron-grey">{formatIssueDate(a.published_on)}</p>
                      {a.headline && <p className="mt-1 text-xs text-bark-brown-light line-clamp-2">{a.headline}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
