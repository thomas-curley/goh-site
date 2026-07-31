import { AvailabilityForm } from "@/components/availability/AvailabilityForm";

export default async function AvailabilityPollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <AvailabilityForm pollId={id} />
    </div>
  );
}
