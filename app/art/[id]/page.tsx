import type { Metadata } from "next";
import { ArtContestPage } from "@/components/art/ArtContestPage";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";

export const metadata: Metadata = {
  title: "Art Contest",
  description: "Enter your artwork, vote for your favourites and see the results.",
};

export const dynamic = "force-dynamic";

export default async function ArtContestRoute({ params }: { params: Promise<{ id: string }> }) {
  if (!(await checkSectionAccess("art"))) return <SectionUnavailable />;
  const { id } = await params;
  return <ArtContestPage contestId={id} />;
}
