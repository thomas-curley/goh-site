import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRsn } from "@/lib/wom";
import { sendDirectMessage } from "@/lib/discord";

/**
 * Matches a payout's free-text recipient_rsn against a linked+verified site
 * account, same precedent as Gnomie Reviews' RSN->Discord resolution, but
 * requiring rsn_verified -- DMing someone is a stronger action than a text
 * mention, so it should require proof of ownership, not just a linked
 * (possibly unverified) RSN.
 */
export async function resolvePayoutRecipient(
  supabase: SupabaseClient,
  rsn: string
): Promise<{ userId: string; discordId: string } | null> {
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, discord_id, rsn")
    .eq("rsn_verified", true)
    .not("rsn", "is", null);

  const normalized = normalizeRsn(rsn);
  const match = (profiles ?? []).find((p) => p.rsn && normalizeRsn(p.rsn) === normalized);
  return match ? { userId: match.id, discordId: match.discord_id } : null;
}

/** Flat {word} -> value substitution, same technique as lib/post-templates.ts's substitute(). */
export function renderDmTemplate(
  template: string,
  data: { user: string; payout: string; competition: string; placement: string }
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => data[key as keyof typeof data] ?? "");
}

async function getDmTemplate(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from("payout_dm_config").select("template").eq("id", 1).maybeSingle();
  return data?.template ?? "🎉 Congratulations {user}! You have a prize pending from **{competition}**: **{payout}**. Reach out to Vlad or Ches on Discord to collect it! 🌿";
}

/**
 * Resolves, renders, and sends the DM for one payout, writing the outcome
 * (recipient_user_id/dm_status/dm_sent_at/dm_error) back onto the row
 * regardless of success or failure -- a caller notifying a batch should call
 * this once per row, sequentially, and never let one failure stop the rest.
 */
export async function notifyPayoutWinner(
  supabase: SupabaseClient,
  payout: { id: string; recipient_rsn: string; prize: string; placement: number | null; competitionLabel: string }
): Promise<void> {
  const recipient = await resolvePayoutRecipient(supabase, payout.recipient_rsn);

  if (!recipient) {
    await supabase
      .from("prize_payouts")
      .update({ dm_status: "skipped", dm_error: "No linked, verified account found for this RSN.", updated_at: new Date().toISOString() })
      .eq("id", payout.id);
    return;
  }

  const template = await getDmTemplate(supabase);
  const content = renderDmTemplate(template, {
    user: payout.recipient_rsn,
    payout: payout.prize,
    competition: payout.competitionLabel,
    placement: payout.placement ? ordinal(payout.placement) : "",
  });

  try {
    await sendDirectMessage(recipient.discordId, content);
    await supabase
      .from("prize_payouts")
      .update({
        recipient_user_id: recipient.userId,
        dm_status: "sent",
        dm_sent_at: new Date().toISOString(),
        dm_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id);
  } catch (err) {
    await supabase
      .from("prize_payouts")
      .update({
        recipient_user_id: recipient.userId,
        dm_status: "failed",
        dm_error: err instanceof Error ? err.message : "Failed to send DM.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id);
  }
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
