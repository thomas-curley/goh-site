"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { RankBadge } from "@/components/ui/RankBadge";
import type { MemberProfile } from "@/lib/gn0mebook";

export function ProfileCard({ profile }: { profile: MemberProfile }) {
  const [imgFailed, setImgFailed] = useState(false);
  const avatarUrl = !imgFailed && (profile.avatar_url || profile.discord_avatar);

  return (
    <Link href={`/gn0mebook/${profile.id}`}>
      <Card className="flex flex-col items-center text-center gap-2 h-full">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            onError={() => setImgFailed(true)}
            className="w-16 h-16 rounded-full object-cover border-2 border-gnome-green/40"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gnome-green/15 flex items-center justify-center text-xl font-display text-gnome-green">
            {profile.discord_username.charAt(0).toUpperCase()}
          </div>
        )}
        <h3 className="font-mono text-base font-bold text-bark-brown truncate w-full">
          {profile.rsn || profile.discord_username}
        </h3>
        {profile.clan_rank && <RankBadge rank={profile.clan_rank} />}
        {profile.tagline && (
          <p className="text-xs text-bark-brown-light line-clamp-2">{profile.tagline}</p>
        )}
      </Card>
    </Link>
  );
}
