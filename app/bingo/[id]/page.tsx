import { BingoBoard } from "@/components/bingo/BingoBoard";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";

export const dynamic = "force-dynamic"; // gated per-viewer, can't be statically cached

export default async function BingoBoardPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await checkSectionAccess("bingo"))) return <SectionUnavailable />;

  const { id } = await params;
  return <BingoBoard eventId={id} />;
}
