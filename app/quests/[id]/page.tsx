import type { Metadata } from "next";
import { QuestEventPage } from "@/components/quests/QuestEventPage";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";

export const metadata: Metadata = {
  title: "Quest Event",
  description: "A clan quest race: join, track your quests with WikiSync and climb the leaderboard.",
};

export const dynamic = "force-dynamic"; // gated per-viewer, can't be statically cached

export default async function QuestEventRoute({ params }: { params: Promise<{ id: string }> }) {
  if (!(await checkSectionAccess("quests"))) return <SectionUnavailable />;

  const { id } = await params;
  return <QuestEventPage eventId={id} />;
}
