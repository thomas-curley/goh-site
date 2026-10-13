"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CharacterEditor } from "@/components/profiles/CharacterEditor";
import { useIsStaff } from "@/lib/use-is-staff";

/** "Profile character (beta)" on My Account, for every signed-in member. */
export function AccountOutfitSection() {
  const isStaff = useIsStaff();
  return (
    <div id="outfit" className="max-w-4xl mx-auto px-4 pb-12 scroll-mt-20">
      <Card hover={false}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 className="font-display text-2xl text-gnome-green">Profile character</h2>
          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-bark-brown">Beta</span>
        </div>
        <p className="text-sm text-bark-brown-light mb-4">
          Your OSRS character in 3D. Set your appearance like the in-game character creator, then dress it in your fashionscape. To show
          it on your <Link href="/gn0mebook/edit" className="text-gnome-green hover:underline">Gn0meBook profile</Link>, turn on
          &quot;Show my OSRS character&quot; there.
          {isStaff && (
            <>
              {" "}
              It also appears on your <Link href="/members/beta" className="text-gnome-green hover:underline">member profile</Link>.
            </>
          )}
        </p>
        <CharacterEditor mode="member" />
      </Card>
    </div>
  );
}
