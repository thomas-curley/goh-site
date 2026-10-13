import { clanPercentile, ordinal, parseTier } from "@/lib/profiles-format";

/** A clan-percentile pill in "parse" colours, e.g. [ 92 ] with "3rd of 24" as its tooltip. */
export function ParseBadge({ rank, count, size = "md" }: { rank: number; count: number; size?: "sm" | "md" }) {
  const percentile = clanPercentile(rank, count);
  const tier = parseTier(percentile);
  return (
    <span
      title={`${ordinal(rank)} of ${count} in the clan · ${tier.label}`}
      className={`inline-flex items-center justify-center rounded font-bold tabular-nums shrink-0 ${size === "sm" ? "min-w-8 px-1.5 text-xs leading-5" : "min-w-10 px-2 text-sm leading-6"}`}
      style={{ backgroundColor: tier.bg, color: tier.fg }}
    >
      {percentile}
    </span>
  );
}
