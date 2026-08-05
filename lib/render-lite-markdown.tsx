import Link from "next/link";
import { Fragment } from "react";

/**
 * A tiny, dependency-free renderer for the handbook's admin-authored text --
 * blank-line-separated paragraphs, "- " prefixed lines grouped into bullet
 * lists, and inline **bold** / *italic* / [text](url) spans. No markdown
 * library, no dangerouslySetInnerHTML -- everything is built as real React
 * elements from a plain split/match pass.
 */

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, keyPrefix: string) {
  return text.split(INLINE_PATTERN).map((part, i) => {
    if (!part) return null;
    const key = `${keyPrefix}-${i}`;

    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={key}>{bold[1]}</strong>;

    const italic = part.match(/^\*([^*]+)\*$/);
    if (italic) return <em key={key}>{italic[1]}</em>;

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, url] = link;
      const linkClass = "text-gnome-green hover:underline font-semibold";
      return url.startsWith("/") ? (
        <Link key={key} href={url} className={linkClass}>{label}</Link>
      ) : (
        <a key={key} href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>{label}</a>
      );
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function RichText({ content, className }: { content: string; className?: string }) {
  const blocks = content.trim().split(/\n\s*\n/).filter(Boolean);

  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every((l) => l.startsWith("- "));
        const isHeading = lines.length === 1 && lines[0].startsWith("## ");

        if (isHeading) {
          return (
            <h3 key={bi} className="font-display text-base text-gnome-green mt-6 mb-2 first:mt-0">
              {renderInline(lines[0].slice(3), `${bi}-h`)}
            </h3>
          );
        }

        if (isList) {
          return (
            <ul key={bi} className="list-disc pl-5 space-y-1.5 mb-4 text-bark-brown-light">
              {lines.map((line, li) => (
                <li key={li}>{renderInline(line.slice(2), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={bi} className="mb-4 text-bark-brown-light leading-relaxed">
            {lines.map((line, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(line, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
