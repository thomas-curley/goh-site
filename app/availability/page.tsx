import { AvailabilityIndex } from "@/components/availability/AvailabilityIndex";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";

export default async function AvailabilityIndexPage() {
  if (!(await checkSectionAccess("availability"))) return <SectionUnavailable />;

  return <AvailabilityIndex />;
}
