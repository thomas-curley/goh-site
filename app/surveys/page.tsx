import { SurveysIndex } from "@/components/surveys/SurveysIndex";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";

export default async function SurveysIndexPage() {
  if (!(await checkSectionAccess("surveys"))) return <SectionUnavailable />;

  return <SurveysIndex />;
}
