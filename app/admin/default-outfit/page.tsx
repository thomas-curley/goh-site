import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CharacterEditor } from "@/components/profiles/CharacterEditor";

export default function AdminDefaultOutfitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-gnome-green mb-1">Default Clan Outfit</h1>
        <p className="text-bark-brown-light">
          The character every member wears on their{" "}
          <Link href="/members/beta" className="text-gnome-green hover:underline">profile</Link> until they make their own: set it to
          the clan&apos;s gnome fashionscape. Members who change only some things keep the default for the rest, so any gear slot they
          leave empty shows what you pick here.
        </p>
      </div>

      <Card hover={false}>
        <CharacterEditor mode="default" />
      </Card>
    </div>
  );
}
