import { QuestBuilder } from "@/components/admin/quests/QuestBuilder";

export default async function QuestBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestBuilder id={id} />;
}
