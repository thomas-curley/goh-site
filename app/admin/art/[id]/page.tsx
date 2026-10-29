import { ArtBuilder } from "@/components/admin/art/ArtBuilder";

export default async function ArtContestAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArtBuilder id={id} />;
}
