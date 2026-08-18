import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";

export default async function FeedbackPage() {
  if (!(await checkSectionAccess("feedback"))) return <SectionUnavailable />;

  return <FeedbackForm />;
}
