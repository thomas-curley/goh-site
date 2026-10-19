import { BingoBuilder } from "@/components/admin/bingo/BingoBuilder";

export default async function BingoBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BingoBuilder id={id} />;
}
