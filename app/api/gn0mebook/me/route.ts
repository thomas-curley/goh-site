import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility, type AccessLevel } from "@/lib/clan-access";
import { getProfileByUserId } from "@/lib/gn0mebook";

const VALID_VISIBILITY: AccessLevel[] = ["anonymous", "verified_player", "clan_member"];
const MAX_TEXT_LENGTH = 4000;
const MAX_TAGLINE_LENGTH = 150;
const MAX_PRONOUNS_LENGTH = 30;
const MAX_SOCIAL_LINKS = 8;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getCallerId() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  return user?.id ?? null;
}

// GET - the caller's own profile (published or not), or {profile: null} if
// they haven't made one yet.
export async function GET() {
  const userId = await getCallerId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const profile = await getProfileByUserId(userId);
  return NextResponse.json({ profile });
}

// PUT - create or update the caller's own profile. Requires a linked and
// verified RSN. Only ever touches fields the caller is allowed to control --
// hidden_by_admin is never accepted here.
export async function PUT(request: NextRequest) {
  const userId = await getCallerId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const eligibility = await checkClanEligibility(supabase, "verified_player", userId, "a Gn0meBook profile");
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason ?? "You must link and verify an RSN first." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) || null : null);

  const socialLinks = Array.isArray(body.socialLinks)
    ? (body.socialLinks as unknown[])
        .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
        .map((l) => ({
          label: typeof l.label === "string" ? l.label.trim().slice(0, 40) : "",
          url: typeof l.url === "string" ? l.url.trim().slice(0, 500) : "",
        }))
        .filter((l) => l.label && l.url)
        .slice(0, MAX_SOCIAL_LINKS)
    : [];

  const update = {
    user_id: userId,
    pronouns: text(body.pronouns, MAX_PRONOUNS_LENGTH),
    tagline: text(body.tagline, MAX_TAGLINE_LENGTH),
    about: text(body.about, MAX_TEXT_LENGTH),
    interests: text(body.interests, MAX_TEXT_LENGTH),
    play_schedule: text(body.playSchedule, MAX_TEXT_LENGTH),
    in_game_focus: text(body.inGameFocus, MAX_TEXT_LENGTH),
    avatar_url: typeof body.avatarUrl === "string" ? body.avatarUrl.trim() || null : null,
    banner_url: typeof body.bannerUrl === "string" ? body.bannerUrl.trim() || null : null,
    social_links: socialLinks,
    is_published: body.isPublished !== false,
    visibility: VALID_VISIBILITY.includes(body.visibility) ? body.visibility : "anonymous",
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("member_profiles").upsert(update, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Failed to save your profile." }, { status: 500 });

  return NextResponse.json({ saved: true });
}

// DELETE - remove the caller's own profile entirely.
export async function DELETE() {
  const userId = await getCallerId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await supabase.from("member_profiles").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: "Failed to delete your profile." }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
