import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility } from "@/lib/clan-access";

const MAX_MESSAGE_LENGTH = 1000;

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

// PUT - create or update the caller's own testimonial. Requires a linked and
// verified RSN. Upserts on user_id (one testimonial per member) -- every
// resubmission resets status back to pending and clears the prior review,
// so an edited testimonial always gets a fresh look before it's public again.
export async function PUT(request: NextRequest) {
  const userId = await getCallerId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const eligibility = await checkClanEligibility(supabase, "verified_player", userId, "testimonials");
  if (!eligibility.eligible || !eligibility.verifiedName) {
    return NextResponse.json({ error: eligibility.reason ?? "You must link and verify an RSN first." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  if (!message) return NextResponse.json({ error: "Please write a message." }, { status: 400 });

  const { error } = await supabase.from("testimonials").upsert(
    {
      user_id: userId,
      rsn: eligibility.verifiedName,
      rating,
      message,
      status: "pending",
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: "Failed to save your testimonial." }, { status: 500 });

  return NextResponse.json({ saved: true });
}

// DELETE - remove the caller's own testimonial entirely.
export async function DELETE() {
  const userId = await getCallerId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await supabase.from("testimonials").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: "Failed to delete your testimonial." }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
