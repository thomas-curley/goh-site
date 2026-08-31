import type { SupabaseClient } from "@supabase/supabase-js";

export interface CheckInIdentity {
  discordId: string;
  discordUsername: string;
  discordNickname?: string | null;
  rsn: string;
}

export type CheckInResult =
  | { ok: true; name: string }
  | { ok: false; status: number; error: string; codeRequired?: boolean };

/**
 * Shared self-check-in logic reused by the website check-in page and the
 * RuneLite plugin's check-in endpoint, so the code-word gate can't be
 * bypassed by using one path instead of the other. Admin-driven attendance
 * marking (the staff roster UI, screenshot-scan import) never calls this --
 * that's a distinct, staff-authorized action the code was never meant to
 * gate.
 */
export async function checkInToEvent(
  supabase: SupabaseClient,
  eventId: string,
  identity: CheckInIdentity,
  source: string,
  code?: string
): Promise<CheckInResult> {
  const { data: event } = await supabase
    .from("events")
    .select("id, check_in_code")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return { ok: false, status: 404, error: "Event not found." };
  }

  const requiredCode = event.check_in_code?.trim();
  if (requiredCode) {
    const submitted = code?.trim() ?? "";
    if (submitted.toLowerCase() !== requiredCode.toLowerCase()) {
      // codeRequired is set on BOTH "none submitted" and "wrong code" -- a
      // caller whose own cached view of the event thought no code was
      // needed (e.g. the plugin's last poll predates an admin adding one)
      // can react to this signal by prompting and retrying, rather than
      // just failing based on stale local state.
      return {
        ok: false,
        status: 403,
        error: submitted ? "That code doesn't match. Ask the event host for the check-in code." : "This event requires a check-in code.",
        codeRequired: true,
      };
    }
  }

  const { error } = await supabase.from("event_attendance").upsert(
    {
      event_id: eventId,
      discord_id: identity.discordId,
      discord_username: identity.discordUsername,
      discord_nickname: identity.discordNickname ?? null,
      rsn: identity.rsn,
      source,
      signed_up: true,
      attended: true,
      marked_by: "self",
      noted_at: new Date().toISOString(),
    },
    { onConflict: "event_id,discord_id" }
  );

  if (error) {
    return { ok: false, status: 500, error: "Failed to check in. Try again." };
  }

  return { ok: true, name: identity.rsn };
}
