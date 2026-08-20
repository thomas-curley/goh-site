import { BingoList } from "@/components/bingo/BingoList";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bingo Events",
  description: "Clan bingo boards -- team up and race to complete every tile.",
};

export const dynamic = "force-dynamic"; // gated per-viewer, can't be statically cached

export default async function BingoIndexPage() {
  if (!(await checkSectionAccess("bingo"))) return <SectionUnavailable />;

  return <BingoList />;
}
