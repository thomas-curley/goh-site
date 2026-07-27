"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ACCESS_LEVEL_LABELS, type AccessLevel } from "@/lib/surveys";

interface Survey {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  access_level: AccessLevel;
}

export default function SurveysIndexPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/surveys")
      .then((res) => res.json())
      .then((data) => setSurveys(data.surveys ?? []))
      .catch(() => setSurveys([]))
      .finally(() => setLoading(false));
  }, []);

  const active = surveys.filter((s) => s.is_active);
  const closed = surveys.filter((s) => !s.is_active);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-display text-3xl text-gnome-green mb-1">Surveys</h1>
      <p className="text-bark-brown-light mb-8">
        Have your say. Some surveys are open to everyone, others require a linked (and sometimes clan-verified) RSN.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : surveys.length === 0 ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light">No surveys right now — check back soon.</p>
        </Card>
      ) : (
        <>
          <section className="space-y-3 mb-10">
            {active.length === 0 ? (
              <Card hover={false}>
                <p className="text-sm text-iron-grey">No active surveys right now.</p>
              </Card>
            ) : (
              active.map((survey) => <SurveyRow key={survey.id} survey={survey} />)
            )}
          </section>

          {closed.length > 0 && (
            <section>
              <h2 className="font-display text-lg text-bark-brown-light mb-3">Closed</h2>
              <div className="space-y-3 opacity-60">
                {closed.map((survey) => <SurveyRow key={survey.id} survey={survey} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SurveyRow({ survey }: { survey: Survey }) {
  return (
    <Link href={`/surveys/${survey.id}`}>
      <Card className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-bark-brown truncate">
            {survey.title}
            {survey.access_level !== "anonymous" && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gnome-green/10 text-gnome-green align-middle">
                {ACCESS_LEVEL_LABELS[survey.access_level]}
              </span>
            )}
          </h3>
          {survey.description && <p className="text-xs text-bark-brown-light truncate">{survey.description}</p>}
        </div>
        {survey.is_active && <span className="text-sm text-gnome-green shrink-0">Take Survey &rarr;</span>}
      </Card>
    </Link>
  );
}
