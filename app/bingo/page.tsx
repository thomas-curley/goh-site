import { BingoHome } from "@/components/bingo/BingoHome";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clan Bingo",
  description: "Team bingo boards: join, check your team's progress and race the other teams.",
};

export const dynamic = "force-dynamic"; // gated per-viewer, can't be statically cached

export default async function BingoIndexPage() {
  if (!(await checkSectionAccess("bingo"))) return <SectionUnavailable />;

  return <BingoHome />;
}
