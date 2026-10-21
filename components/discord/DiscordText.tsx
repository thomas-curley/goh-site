import { Fragment, type ReactNode } from "react";
import { resolveUnicodeShortcodes } from "@/lib/emoji-shortcodes";
import type { DiscordNames } from "@/lib/discord-names";

// Renders text written for Discord: **bold**, *italic*, __underline__,
// ~~strike~~, `code`, ||spoilers||, # headings, -# small text, > quotes,
// lists, code blocks, custom emoji (<:name:id>), mentions, timestamps and
// links -- as React elements, never raw HTML.

type Names = Pick<DiscordNames, "channels" | "roles" | "users">;

const INLINE =
  /(`[^`\n]+`)|(<a?:\w+:\d+>)|(<@!?\d+>)|(<@&\d+>)|(<#\d+>)|(<t:-?\d+(?::[tTdDfFR])?>)|(\[[^\]\n]+\]\((?:https?:\/\/)[^)\s]+\))|(<?https?:\/\/[^\s<>]+[^\s<>.,;:!?)'"]>?)|(\*\*[\s\S]+?\*\*)|(__[\s\S]+?__)|(~~[\s\S]+?~~)|(\|\|[\s\S]+?\|\|)|(\*[^*\s][^*]*?\*)|(\b_[^_\s][^_]*?_\b)/g;

function emojiUrl(token: string): { url: string; name: string } {
  const m = token.match(/^<(a?):(\w+):(\d+)>$/)!;
  return { url: `https://cdn.discordapp.com/emojis/${m[3]}.${m[1] ? "gif" : "webp"}?size=48&quality=lossless`, name: m[2] };
}

function timestamp(token: string): string {
  const m = token.match(/^<t:(-?\d+)(?::([tTdDfFR]))?>$/)!;
  const d = new Date(Number(m[1]) * 1000);
  switch (m[2]) {
    case "t":
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    case "T":
      return d.toLocaleTimeString();
    case "d":
      return d.toLocaleDateString();
    case "D":
      return d.toLocaleDateString(undefined, { dateStyle: "long" });
    case "F":
      return d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
    case "R": {
      const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(days, "day");
    }
    default:
      return d.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
  }
}

/** A Discord channel/message link as "#channel-name" (or the URL's host for anything else). */
function linkLabel(url: string, names: Names): string {
  const m = url.match(/^https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/\d+\/(\d+)(?:\/\d+)?/);
  if (m) return names.channels[m[1]] ? `#${names.channels[m[1]]}` : "Discord channel";
  try {
    const u = new URL(url);
    return (u.host.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname : "")).slice(0, 48);
  } catch {
    return url;
  }
}

const linkClass = "text-gnome-green underline decoration-gnome-green/40 hover:decoration-gnome-green break-words";

function inline(text: string, names: Names, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const token = m[0];
    const at = m.index ?? 0;
    if (at > last) out.push(resolveUnicodeShortcodes(text.slice(last, at)));
    const key = `${keyBase}-${i++}`;
    if (m[1]) out.push(<code key={key} className="px-1 py-0.5 rounded bg-black/10 font-mono text-[0.9em]">{token.slice(1, -1)}</code>);
    else if (m[2]) {
      const e = emojiUrl(token);
      // eslint-disable-next-line @next/next/no-img-element
      out.push(<img key={key} src={e.url} alt={`:${e.name}:`} title={`:${e.name}:`} className="inline-block h-[1.35em] w-auto align-[-0.3em] mx-px" loading="lazy" />);
    } else if (m[3]) {
      const id = token.replace(/\D/g, "");
      out.push(<span key={key} className="rounded px-1 bg-gnome-green/10 text-gnome-green">@{names.users?.[id] ?? "member"}</span>);
    }
    else if (m[4]) {
      const id = token.slice(3, -1);
      out.push(<span key={key} className="rounded px-1 bg-gnome-green/10 text-gnome-green">@{names.roles[id] ?? "role"}</span>);
    } else if (m[5]) {
      const id = token.slice(2, -1);
      out.push(<span key={key} className="rounded px-1 bg-gnome-green/10 text-gnome-green">#{names.channels[id] ?? "channel"}</span>);
    } else if (m[6]) out.push(<span key={key} className="rounded px-1 bg-black/10">{timestamp(token)}</span>);
    else if (m[7]) {
      const lm = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      out.push(<a key={key} href={lm[2]} target="_blank" rel="noopener noreferrer" className={linkClass}>{inline(lm[1], names, key)}</a>);
    } else if (m[8]) {
      const url = token.replace(/^<|>$/g, "");
      out.push(<a key={key} href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>{linkLabel(url, names)}</a>);
    } else if (m[9]) out.push(<strong key={key} className="font-bold">{inline(token.slice(2, -2), names, key)}</strong>);
    else if (m[10]) out.push(<u key={key}>{inline(token.slice(2, -2), names, key)}</u>);
    else if (m[11]) out.push(<s key={key}>{inline(token.slice(2, -2), names, key)}</s>);
    else if (m[12]) out.push(<span key={key} className="rounded bg-bark-brown/20 px-0.5">{inline(token.slice(2, -2), names, key)}</span>);
    else if (m[13] || m[14]) out.push(<em key={key}>{inline(token.slice(1, -1), names, key)}</em>);
    last = at + token.length;
  }
  if (last < text.length) out.push(resolveUnicodeShortcodes(text.slice(last)));
  return out;
}

/** Discord-formatted text as blocks: headings, small text, quotes, lists, code blocks, paragraphs. */
export function DiscordText({ text, names = { channels: {}, roles: {} } }: { text: string; names?: Names }) {
  const blocks: ReactNode[] = [];
  const parts = text.replace(/\r\n/g, "\n").split(/(```[\s\S]*?```)/g);
  let k = 0;
  for (const part of parts) {
    if (part.startsWith("```") && part.endsWith("```") && part.length >= 6) {
      const body = part.slice(3, -3).replace(/^\w*\n/, "");
      blocks.push(
        <pre key={k++} className="rounded-md bg-black/10 p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
          {body}
        </pre>
      );
      continue;
    }
    let list: { ordered: boolean; items: ReactNode[] } | null = null;
    const flush = () => {
      if (!list) return;
      const Tag = list.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={k++} className={`${list.ordered ? "list-decimal" : "list-disc"} pl-6 space-y-0.5`}>
          {list.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </Tag>
      );
      list = null;
    };
    for (const raw of part.split("\n")) {
      const line = raw.trimEnd();
      const key = `b${k}`;
      let m: RegExpMatchArray | null;
      if (!line.trim()) {
        flush();
        continue;
      }
      if ((m = line.match(/^\s*[-*]\s+(.*)$/)) && !line.startsWith("-# ")) {
        if (list?.ordered !== false) {
          flush();
          list = { ordered: false, items: [] };
        }
        list!.items.push(inline(m[1], names, `${key}-${list!.items.length}`));
        continue;
      }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        if (list?.ordered !== true) {
          flush();
          list = { ordered: true, items: [] };
        }
        list!.items.push(inline(m[1], names, `${key}-${list!.items.length}`));
        continue;
      }
      flush();
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        const size = m[1].length === 1 ? "text-xl" : m[1].length === 2 ? "text-lg" : "text-base";
        blocks.push(<p key={k++} className={`${size} font-bold text-bark-brown mt-2`}>{inline(m[2], names, key)}</p>);
      } else if ((m = line.match(/^-#\s+(.*)$/))) {
        blocks.push(<p key={k++} className="text-xs text-iron-grey">{inline(m[1], names, key)}</p>);
      } else if ((m = line.match(/^>>?>?\s?(.*)$/))) {
        blocks.push(<blockquote key={k++} className="border-l-4 border-bark-brown-light/40 pl-3">{inline(m[1], names, key)}</blockquote>);
      } else {
        blocks.push(<p key={k++}>{inline(line, names, key)}</p>);
      }
    }
    flush();
  }
  return <div className="space-y-1.5 break-words">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}

/** One line of Discord text with its formatting (for titles and previews): emoji and inline styles, no blocks. */
export function DiscordInline({ text, names = { channels: {}, roles: {} } }: { text: string; names?: Names }) {
  const flat = text
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .map((l) => l.replace(/^(#{1,3}|-#|>{1,3})\s+/, "").replace(/^\s*(?:[-*]|\d+[.)])\s+/, "• "))
    .filter((l) => l.trim())
    .join(" ");
  return <>{inline(flat, names, "i")}</>;
}
