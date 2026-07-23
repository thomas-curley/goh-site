import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkPermission } from "@/lib/check-permission";
import { postToChannel, resolvePostDestination } from "@/lib/discord";
import { STAFF_APPLICATION_QUESTIONS } from "@/lib/staff-application-questions";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_ANSWER_LENGTH = 1000;

// POST - submit a staff application using the caller's own authenticated
// session. Identity is always read from the session/profile, never from the
// request body, so a signed-in user can only apply as themselves.
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in to apply." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("discord_id, discord_username, rsn")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.discord_id) {
    return NextResponse.json(
      { error: "We couldn't find your Discord profile. Try logging out and back in." },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("staff_applications")
    .select("id")
    .eq("discord_id", profile.discord_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You already have a pending application." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const rawAnswers = body.answers && typeof body.answers === "object" ? body.answers : {};

  const answers = STAFF_APPLICATION_QUESTIONS.map((q) => ({
    key: q.key,
    label: q.label,
    answer: typeof rawAnswers[q.key] === "string" ? rawAnswers[q.key].trim().slice(0, MAX_ANSWER_LENGTH) : "",
  }));

  const missingRequired = answers.some((a) => a.key !== "other" && !a.answer);
  if (missingRequired) {
    return NextResponse.json({ error: "Please answer all required questions." }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("staff_applications")
    .insert({
      discord_id: profile.discord_id,
      discord_username: profile.discord_username,
      rsn: profile.rsn,
      answers,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: "Failed to submit application. Try again." }, { status: 500 });
  }

  try {
    const channelId = resolvePostDestination(undefined, process.env.DISCORD_STAFF_CHANNEL_ID);
    if (channelId) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gn0mehome.com";
      const applicantLabel = profile.rsn ? `${profile.discord_username} (${profile.rsn})` : profile.discord_username;
      await postToChannel(
        channelId,
        `📋 **New staff application** from ${applicantLabel}\nReview it at ${siteUrl}/admin/staff-applications`
      );
    }
  } catch (discordError) {
    console.error("Staff application Discord notification failed:", discordError);
    // Continue — the application is already saved even if the notification fails
  }

  return NextResponse.json({ id: inserted.id });
}

// GET - list applications for admin review, optionally filtered by status.
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_staff_applications");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const status = request.nextUrl.searchParams.get("status");

  let query = supabase.from("staff_applications").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load applications." }, { status: 500 });

  return NextResponse.json({ applications: data ?? [] });
}
