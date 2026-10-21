import type { Metadata } from "next";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import { ClanPageShell } from "@/components/clan/ClanPageShell";
import { RankList } from "@/components/clan/RankList";
import { getClanPage } from "@/lib/clan-pages";
import { CLAN_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Rank Structure",
  description: `How ranks work in ${CLAN_NAME}, from Gnome Child to Gold Key.`,
};

export const dynamic = "force-dynamic";

export default async function RankStructurePage() {
  if (!(await checkSectionAccess("rank_structure"))) return <SectionUnavailable />;

  return (
    <ClanPageShell
      title="Rank Structure"
      intro={`How ranks work in ${CLAN_NAME}, and what each one means.`}
      page={await getClanPage("rank-structure")}
      fallback={<RankList />}
    />
  );
}
