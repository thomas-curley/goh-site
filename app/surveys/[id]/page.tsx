import { TakeSurveyForm } from "@/components/surveys/TakeSurveyForm";

export default async function TakeSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <TakeSurveyForm surveyId={id} />
    </div>
  );
}
