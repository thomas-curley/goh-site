"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SurveyQuestion } from "@/lib/surveys";

interface Survey {
  id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  is_active: boolean;
}

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export function TakeSurveyForm({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [respondentName, setRespondentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/surveys/${surveyId}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) setSurvey(data.survey);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [surveyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/surveys/${surveyId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, respondentName }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError(data.error ?? "Failed to submit. Try again.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !survey) {
    return (
      <Card hover={false} className="text-center py-10">
        <p className="text-bark-brown-light">Survey not found.</p>
      </Card>
    );
  }

  if (!survey.is_active) {
    return (
      <>
        <h1 className="font-display text-3xl text-gnome-green mb-4">{survey.title}</h1>
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light">This survey is closed and no longer accepting responses.</p>
        </Card>
      </>
    );
  }

  if (submitted) {
    return (
      <>
        <h1 className="font-display text-3xl text-gnome-green mb-4">{survey.title}</h1>
        <Card hover={false} className="text-center py-10">
          <p className="font-display text-xl text-bark-brown mb-2">Thanks!</p>
          <p className="text-bark-brown-light">Your response has been recorded.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl text-gnome-green mb-1">{survey.title}</h1>
      {survey.description && <p className="text-bark-brown-light mb-6">{survey.description}</p>}

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {survey.questions.map((q) => (
          <Card key={q.id} hover={false}>
            <label className="block text-sm font-semibold text-bark-brown mb-2">
              {q.prompt}{q.required && <span className="text-red-accent"> *</span>}
            </label>

            {q.type === "rating" && (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: String(n) }))}
                    className={`w-10 h-10 rounded-md border-2 font-stats font-bold cursor-pointer transition-colors ${
                      answers[q.id] === String(n)
                        ? "bg-gnome-green border-gnome-green text-text-light"
                        : "bg-transparent border-bark-brown-light text-bark-brown hover:border-gnome-green"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            {q.type === "multiple_choice" && (
              <div className="space-y-2">
                {(q.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                      className="accent-gnome-green"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.type === "text" && (
              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                rows={3}
                maxLength={2000}
                required={q.required}
                className={inputClass}
              />
            )}
          </Card>
        ))}

        <Card hover={false}>
          <label className="block text-sm font-semibold text-bark-brown mb-1">Your RSN or Discord name (optional)</label>
          <input
            type="text"
            value={respondentName}
            onChange={(e) => setRespondentName(e.target.value)}
            placeholder="Leave blank to stay anonymous"
            className={inputClass}
          />
        </Card>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </>
  );
}
