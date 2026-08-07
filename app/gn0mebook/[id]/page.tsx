import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfileById } from "@/lib/gn0mebook";
import { checkClanEligibility } from "@/lib/clan-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { RankBadge } from "@/components/ui/RankBadge";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfileById(id);
  const name = profile?.rsn || profile?.discord_username || "Profile";
  return { title: `${name} - Gn0meBook` };
}

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfileById(id);

  if (!profile || !profile.is_published || profile.hidden_by_admin) {
    notFound();
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const serviceClient = getServiceClient();
  const eligibility = serviceClient
    ? await checkClanEligibility(serviceClient, profile.visibility, user?.id ?? null, "this profile")
    : { eligible: true };

  const avatarUrl = profile.avatar_url || profile.discord_avatar;
  const name = profile.rsn || profile.discord_username;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {profile.banner_url && (
        <div className="relative w-full h-48 rounded-lg overflow-hidden mb-[-3rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
          {/* Scrim so the name/rank overlaid below stay readable over any photo. */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex items-end gap-4 mb-6 px-2">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-parchment shadow-lg" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gnome-green/15 flex items-center justify-center text-3xl font-display text-gnome-green border-4 border-parchment shadow-lg">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 pb-1">
          <h1
            className={`font-display text-3xl truncate ${
              profile.banner_url ? "text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]" : "text-gnome-green"
            }`}
          >
            {name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {profile.clan_rank && <RankBadge rank={profile.clan_rank} />}
          </div>
        </div>
      </div>

      {profile.tagline && <p className="text-lg text-bark-brown-light italic mb-6">&ldquo;{profile.tagline}&rdquo;</p>}

      {!eligibility.eligible ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light mb-4">{eligibility.reason}</p>
          {eligibility.reason?.includes("signed in") ? (
            <Link href="/login" className="text-sm text-gnome-green hover:underline">Log in →</Link>
          ) : eligibility.reason?.includes("Link and verify") ? (
            <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account →</Link>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-6">
          {profile.about && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-2">About Me</h2>
              <p className="text-bark-brown-light whitespace-pre-wrap">{profile.about}</p>
            </Card>
          )}
          {profile.interests && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-2">Things I Like To Do</h2>
              <p className="text-bark-brown-light whitespace-pre-wrap">{profile.interests}</p>
            </Card>
          )}
          {profile.play_schedule && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-2">When I Usually Play</h2>
              <p className="text-bark-brown-light whitespace-pre-wrap">{profile.play_schedule}</p>
            </Card>
          )}
          {profile.in_game_focus && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-2">What I Do In-Game</h2>
              <p className="text-bark-brown-light whitespace-pre-wrap">{profile.in_game_focus}</p>
            </Card>
          )}
          {profile.social_links.length > 0 && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-2">Find Me Elsewhere</h2>
              <ul className="space-y-1">
                {profile.social_links.map((link, i) => (
                  <li key={i}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-gnome-green hover:underline">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
