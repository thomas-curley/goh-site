import { createHmac, randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { checkClanEligibility } from "@/lib/clan-access";
import { getAlertChannel } from "@/lib/alert-channels";
import { postToDestination } from "@/lib/discord";
import { getRequestIp } from "@/lib/ip-ban";
import type { ArtContest, ArtEntry } from "@/lib/art";

export const ART_BUCKET = "art";
export const ART_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const CONTEST_COLUMNS =
  "id, name, description, rules, theme, banner_url, status, submissions_close_at, voting_close_at, submit_eligibility, max_entries_per_person, max_images_per_entry, votes_per_voter, vote_eligibility, show_live_results, comments_visibility, anonymous_voting, created_at, updated_at";
export const ENTRY_COLUMNS =
  "id, contest_id, user_id, rsn, title, description, image_paths, visibility, credit, credit_name, gallery_opt_in, agreed_rules, status, review_note, reviewed_by, reviewed_at, gallery_hidden, created_at, updated_at";

export function artServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

export async function loadContest(supabase: SupabaseClient, id: string): Promise<ArtContest | null> {
  const { data } = await supabase.from("art_contests").select(CONTEST_COLUMNS).eq("id", id).maybeSingle();
  return (data as ArtContest) ?? null;
}

// ── Viewer ──────────────────────────────────────────────────────────

export interface ArtViewer {
  userId: string | null;
  rsn: string | null;
  discordName: string | null;
  verified: boolean;
  /** A linked, verified RSN that's currently in the clan. */
  clanMember: boolean;
  /** Why they aren't a clan member (for messages), if they aren't. */
  clanReason: string | null;
  isStaff: boolean;
}

export async function getArtViewer(supabase: SupabaseClient): Promise<ArtViewer> {
  const none: ArtViewer = { userId: null, rsn: null, discordName: null, verified: false, clanMember: false, clanReason: "Sign in with Discord first.", isStaff: false };
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { checkPermission } = await import("@/lib/check-permission");
    const auth = await createSupabaseServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return none;
    const [{ data: profile }, clan, perm] = await Promise.all([
      supabase.from("user_profiles").select("rsn, rsn_verified, discord_username").eq("id", user.id).maybeSingle(),
      checkClanEligibility(supabase, "clan_member", user.id, "this"),
      checkPermission("manage_art"),
    ]);
    return {
      userId: user.id,
      rsn: profile?.rsn ?? null,
      discordName: profile?.discord_username ?? null,
      verified: !!profile?.rsn_verified,
      clanMember: clan.eligible,
      clanReason: clan.eligible ? null : clan.reason ?? "You need to be a current clan member.",
      isStaff: perm.allowed,
    };
  } catch {
    return none;
  }
}

/** Whether the viewer may enter this contest, and why not. */
export function canSubmit(contest: ArtContest, viewer: ArtViewer): { ok: boolean; reason?: string } {
  if (contest.status !== "submissions") return { ok: false, reason: "This contest isn't taking entries right now." };
  if (contest.submissions_close_at && Date.parse(contest.submissions_close_at) <= Date.now()) return { ok: false, reason: "Entries have closed." };
  if (!viewer.userId) return { ok: false, reason: "Sign in with Discord to enter." };
  if (contest.submit_eligibility === "clan" && !viewer.clanMember) return { ok: false, reason: viewer.clanReason ?? "This contest is for clan members." };
  return { ok: true };
}

/** The key a ballot is stored under (one ballot per key), or why the viewer can't vote. */
export function voterKeyFor(contest: ArtContest, viewer: ArtViewer, request: NextRequest): { key: string; name: string | null } | { error: string } {
  if (contest.status !== "voting") return { error: "Voting isn't open for this contest." };
  if (contest.voting_close_at && Date.parse(contest.voting_close_at) <= Date.now()) return { error: "Voting has closed." };
  if (contest.vote_eligibility === "ip") {
    const ip = getRequestIp(request);
    if (!ip) return { error: "We couldn't tell where you're voting from. Try again on a normal connection." };
    const secret = process.env.ART_VOTE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "art";
    const hash = createHmac("sha256", secret).update(`${contest.id}:${ip}`).digest("hex").slice(0, 32);
    return { key: `ip:${hash}`, name: viewer.rsn ?? viewer.discordName };
  }
  if (!viewer.userId) return { error: "Sign in with Discord to vote." };
  if (contest.vote_eligibility === "clan" && !viewer.clanMember) return { error: viewer.clanReason ?? "Only clan members can vote in this contest." };
  return { key: `user:${viewer.userId}`, name: viewer.rsn ?? viewer.discordName };
}

/** Whether the viewer may see an entry at all (privacy and review status). */
export function canSeeEntry(entry: ArtEntry, viewer: ArtViewer): boolean {
  if (viewer.isStaff || (viewer.userId && entry.user_id === viewer.userId)) return true;
  if (entry.status !== "approved") return false;
  return entry.visibility === "public" || viewer.clanMember;
}

// ── Images ──────────────────────────────────────────────────────────

/** Signed links for private artwork, keyed by path (1 hour by default). */
export async function signImages(supabase: SupabaseClient, paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from(ART_BUCKET).createSignedUrls(unique, expiresIn);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
}

/** A one-time upload link for one image, under contest/user/. */
export async function createUploadSlot(supabase: SupabaseClient, contestId: string, userId: string, contentType: string): Promise<{ path: string; token: string } | null> {
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[contentType];
  if (!ext) return null;
  const path = `${contestId}/${userId}/${randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(ART_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return null;
  return { path, token: data.token };
}

/** Only paths uploaded by this user for this contest are accepted on an entry. */
export function ownPaths(paths: unknown, contestId: string, userId: string, max: number): string[] {
  const prefix = `${contestId}/${userId}/`;
  return (Array.isArray(paths) ? paths : []).filter((p): p is string => typeof p === "string" && p.startsWith(prefix) && !p.includes("..")).slice(0, max);
}

/** The artist-editable fields of an entry, cleaned up. */
export function readEntryFields(body: Record<string, unknown>) {
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return {
    title: text(body.title, 100),
    description: text(body.description, 1000) || null,
    visibility: body.visibility === "clan" ? "clan" : "public",
    credit: body.credit === "custom" || body.credit === "anonymous" ? body.credit : "rsn",
    credit_name: body.credit === "custom" ? text(body.credit_name, 40) || null : null,
    gallery_opt_in: !!body.gallery_opt_in,
  } as const;
}

// ── Discord ─────────────────────────────────────────────────────────

export async function announceArt(supabase: SupabaseClient, title: string, content: string, images?: string[]) {
  try {
    const channelId = await getAlertChannel(supabase, "art_contests");
    if (channelId) await postToDestination(channelId, title, content, images?.length ? images : undefined);
  } catch (err) {
    console.error("Art contest Discord post failed:", err);
  }
}
