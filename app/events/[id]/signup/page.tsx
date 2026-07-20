import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { EventSignupForm } from "@/components/events/EventSignupForm";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = getServiceClient();
  const { data: event } = (await supabase
    ?.from("events")
    .select("title")
    .eq("id", id)
    .single()) ?? { data: null };

  return {
    title: event ? `Check In — ${event.title}` : "Event Check-In",
    description: "Check in to a Gn0me Home clan event.",
  };
}

export default async function EventSignupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getServiceClient();

  if (!supabase) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-bark-brown-light">Supabase isn&apos;t configured.</p>
      </div>
    );
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, title, description, event_type, start_time, end_time, location, meet_location, prize_pool, banner_url")
    .eq("id", id)
    .single();

  if (!event) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="font-display text-3xl text-gnome-green mb-2">Event Not Found</h1>
        <p className="text-bark-brown-light">This event doesn&apos;t exist or may have been removed.</p>
      </div>
    );
  }

  // Check whether the visitor is logged in, and if so, whether they've
  // already checked in and what identity we'd check them in as.
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  let profile: { rsn: string | null; rsn_verified: boolean; discord_username: string | null } | null = null;
  let alreadyCheckedIn: { rsn: string | null; discord_username: string | null } | null = null;

  if (user) {
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("rsn, rsn_verified, discord_username, discord_id")
      .eq("id", user.id)
      .maybeSingle();
    profile = profileData;

    if (profileData?.discord_id) {
      const { data: existing } = await supabase
        .from("event_attendance")
        .select("rsn, discord_username")
        .eq("event_id", id)
        .eq("discord_id", profileData.discord_id)
        .maybeSingle();
      alreadyCheckedIn = existing;
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      {event.banner_url && (
        <img
          src={event.banner_url}
          alt={event.title}
          className="w-full rounded-md border border-bark-brown-light mb-6 max-h-56 object-cover"
        />
      )}

      <h1 className="font-display text-3xl text-gnome-green mb-1">{event.title}</h1>
      <p className="text-bark-brown-light mb-6">
        {new Date(event.start_time).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {event.location && <> · {event.location}</>}
      </p>

      <Card hover={false} className="mb-6">
        {event.description && <p className="text-sm text-bark-brown-light mb-3">{event.description}</p>}
        {event.meet_location && (
          <p className="text-sm">
            <span className="text-iron-grey">Meet: </span>
            {event.meet_location}
          </p>
        )}
        {event.prize_pool && (
          <p className="text-sm">
            <span className="text-iron-grey">Prize Pool: </span>
            {event.prize_pool}
          </p>
        )}
      </Card>

      <EventSignupForm
        eventId={event.id}
        loggedIn={!!user}
        profile={profile}
        alreadyCheckedIn={alreadyCheckedIn}
      />
    </div>
  );
}
