"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LIKERT_LABELS, type AccessLevel, type EligibilityResult, type SurveyQuestion } from "@/lib/surveys";
import { HONEYPOT_FIELD } from "@/lib/spam-guard";

interface Survey {
  id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  is_active: boolean;
  access_level: AccessLevel;
}

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export function TakeSurveyForm({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [respondentName, setRespondentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());

  useEffect(() => {
    fetch(`/api/surveys/${surveyId}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setSurvey(data.survey);
          setEligibility(data.eligibility ?? { eligible: true });
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [surveyId]);

  const toggleMultiAnswer = (questionId: string, option: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = checked ? [...current, option] : current.filter((o) => o !== option);
      return { ...prev, [questionId]: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/surveys/${surveyId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, respondentName, renderedAt, [HONEYPOT_FIELD]: honeypot }),
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

  if (eligibility && !eligibility.eligible) {
    return (
      <>
        <h1 className="font-display text-3xl text-gnome-green mb-4">{survey.title}</h1>
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light mb-4">{eligibility.reason}</p>
          {eligibility.reason?.includes("signed in") ? (
            <Link href="/login" className="text-sm text-gnome-green hover:underline">Log in →</Link>
          ) : eligibility.reason?.includes("Link and verify") ? (
            <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account →</Link>
          ) : null}
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
        <input
          type="text"
          name={HONEYPOT_FIELD}
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />
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

            {q.type === "likert" && (
              <div className="flex justify-between gap-1 sm:gap-2">
                {LIKERT_LABELS[q.scale ?? 5].map((label, idx) => {
                  const n = idx + 1;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: String(n) }))}
                      className="flex flex-col items-center gap-1.5 flex-1 cursor-pointer group"
                    >
                      <span className="text-[11px] text-bark-brown-light text-center leading-tight group-hover:text-gnome-green transition-colors">
                        {label}
                      </span>
                      <span
                        className={`w-6 h-6 rounded-full border-2 transition-colors ${
                          answers[q.id] === String(n)
                            ? "bg-gnome-green border-gnome-green"
                            : "bg-transparent border-bark-brown-light group-hover:border-gnome-green"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "multiple_choice" && q.allowMultiple && (
              <div className="space-y-2">
                {(q.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-bark-brown cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt)}
                      onChange={(e) => toggleMultiAnswer(q.id, opt, e.target.checked)}
                      className="accent-gnome-green"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.type === "multiple_choice" && !q.allowMultiple && (
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

        {survey.access_level === "anonymous" ? (
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
        ) : (
          <Card hover={false}>
            <p className="text-sm text-bark-brown">
              Submitting as <span className="font-semibold">{eligibility?.verifiedName}</span>
            </p>
          </Card>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </>
  );
}
