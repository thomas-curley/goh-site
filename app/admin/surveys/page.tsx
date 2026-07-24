"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { QUESTION_TYPE_LABELS, type QuestionType, type SurveyQuestion } from "@/lib/surveys";

interface Survey {
  id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

interface SurveyResponse {
  id: string;
  answers: { question_id: string; value: string | number | null }[];
  respondent_name: string | null;
  submitted_at: string;
}

const QUESTION_TYPES: QuestionType[] = ["rating", "multiple_choice", "text"];
const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

function newQuestion(): SurveyQuestion {
  return { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: "text", prompt: "", options: [], required: false };
}

export default function AdminSurveysPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([newQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responsesBySurvey, setResponsesBySurvey] = useState<Record<string, SurveyResponse[]>>({});
  const [loadingResponses, setLoadingResponses] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/surveys");
    const data = await res.json().catch(() => ({}));
    setSurveys(res.ok ? data.surveys ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadSurveys(); }, [loadSurveys]);

  const updateQuestion = (i: number, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };
  const addQuestion = () => setQuestions((prev) => [...prev, newQuestion()]);
  const removeQuestion = (i: number) => setQuestions((prev) => prev.filter((_, idx) => idx !== i));

  const addOption = (i: number) => updateQuestion(i, { options: [...(questions[i].options ?? []), ""] });
  const updateOption = (i: number, oi: number, value: string) => {
    const options = [...(questions[i].options ?? [])];
    options[oi] = value;
    updateQuestion(i, { options });
  };
  const removeOption = (i: number, oi: number) => {
    updateQuestion(i, { options: (questions[i].options ?? []).filter((_, idx) => idx !== oi) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setStatus(null);

    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, questions }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setStatus(`Survey created. Share it at /surveys/${data.id}`);
      setTitle("");
      setDescription("");
      setQuestions([newQuestion()]);
      await loadSurveys();
    } else {
      setError(data.error ?? "Failed to create survey.");
    }
    setSubmitting(false);
  };

  const toggleExpand = async (survey: Survey) => {
    if (expandedId === survey.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(survey.id);
    if (!responsesBySurvey[survey.id]) {
      setLoadingResponses(survey.id);
      const res = await fetch(`/api/surveys/${survey.id}/responses`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setResponsesBySurvey((prev) => ({ ...prev, [survey.id]: data.responses ?? [] }));
      setLoadingResponses(null);
    }
  };

  const toggleActive = async (survey: Survey) => {
    setTogglingId(survey.id);
    await fetch(`/api/surveys/${survey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !survey.is_active }),
    });
    await loadSurveys();
    setTogglingId(null);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Surveys</h1>
      <p className="text-bark-brown-light mb-6">
        Build a survey, share the link, and view results here. Responses are anonymous unless the respondent chooses to share their name.
      </p>

      <Card hover={false} className="mb-8">
        <h3 className="font-display text-lg text-bark-brown mb-4">New Survey</h3>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">
            {error}
          </div>
        )}
        {status && (
          <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
            {status}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} placeholder="Q3 Satisfaction Survey" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-bark-brown mb-2">Questions</label>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <Card key={q.id} hover={false} className="bg-parchment-dark/30">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={q.prompt}
                      onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                      placeholder="Question prompt"
                      className={inputClass}
                    />
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(i, { type: e.target.value as QuestionType, options: e.target.value === "multiple_choice" ? ["", ""] : [] })}
                      className="px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green w-44 shrink-0 cursor-pointer"
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => removeQuestion(i)} className="text-red-accent text-xs cursor-pointer shrink-0 px-2">✕</button>
                    )}
                  </div>

                  {q.type === "multiple_choice" && (
                    <div className="space-y-1.5 mb-2 ml-2">
                      {(q.options ?? []).map((opt, oi) => (
                        <div key={oi} className="flex gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(i, oi, e.target.value)}
                            placeholder={`Option ${oi + 1}`}
                            className={`${inputClass} flex-1`}
                          />
                          {(q.options?.length ?? 0) > 2 && (
                            <button type="button" onClick={() => removeOption(i, oi)} className="text-red-accent text-xs cursor-pointer px-2">✕</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => addOption(i)} className="text-xs text-gnome-green hover:underline cursor-pointer">
                        + Add option
                      </button>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs text-bark-brown cursor-pointer">
                    <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(i, { required: e.target.checked })} className="accent-gnome-green" />
                    Required
                  </label>
                </Card>
              ))}
            </div>
            <button type="button" onClick={addQuestion} className="text-xs text-gnome-green hover:underline mt-3 cursor-pointer">
              + Add question
            </button>
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Survey"}
          </Button>
        </form>
      </Card>

      <h3 className="font-display text-lg text-bark-brown mb-4">Existing Surveys</h3>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : surveys.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">No surveys yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {surveys.map((survey) => {
            const expanded = expandedId === survey.id;
            const responses = responsesBySurvey[survey.id] ?? [];

            return (
              <Card key={survey.id} hover={false}>
                <button onClick={() => toggleExpand(survey)} className="w-full flex items-center justify-between gap-4 text-left cursor-pointer">
                  <div className="min-w-0">
                    <p className="font-semibold text-bark-brown truncate">
                      {survey.title}
                      {!survey.is_active && <span className="ml-2 text-xs text-iron-grey">(Closed)</span>}
                    </p>
                    <p className="text-xs text-iron-grey">
                      {new Date(survey.created_at).toLocaleDateString()}
                      {survey.created_by && <span> · by {survey.created_by}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-gnome-green shrink-0">{expanded ? "Hide" : "View Results"}</span>
                </button>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-parchment-dark space-y-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/surveys/${survey.id}`} target="_blank" className="text-xs text-gnome-green hover:underline">
                        Open survey link →
                      </Link>
                      <Button size="sm" variant="ghost" disabled={togglingId === survey.id} onClick={() => toggleActive(survey)}>
                        {togglingId === survey.id ? "..." : survey.is_active ? "Close Survey" : "Reopen Survey"}
                      </Button>
                    </div>

                    {loadingResponses === survey.id ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-iron-grey">
                          {responses.length} response{responses.length === 1 ? "" : "s"}
                        </p>
                        {survey.questions.map((q) => (
                          <QuestionResults key={q.id} question={q} responses={responses} />
                        ))}
                        {responses.length > 0 && (
                          <div>
                            <p className="text-xs text-iron-grey uppercase tracking-wide mb-2">Respondents</p>
                            <ul className="text-sm text-bark-brown space-y-0.5">
                              {responses.map((r) => (
                                <li key={r.id}>
                                  {r.respondent_name || "Anonymous"} · {new Date(r.submitted_at).toLocaleDateString()}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuestionResults({ question, responses }: { question: SurveyQuestion; responses: SurveyResponse[] }) {
  const values = responses
    .map((r) => r.answers.find((a) => a.question_id === question.id)?.value)
    .filter((v): v is string | number => v !== null && v !== undefined);

  if (question.type === "rating") {
    const nums = values.filter((v): v is number => typeof v === "number");
    const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    const data = [1, 2, 3, 4, 5].map((n) => ({ rating: String(n), count: nums.filter((v) => v === n).length }));
    return (
      <div>
        <p className="text-sm font-semibold text-bark-brown mb-1">{question.prompt}</p>
        <p className="text-xs text-iron-grey mb-2">Average: {avg.toFixed(1)} / 5 ({nums.length} rated)</p>
        {nums.length > 0 && (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8D5A8" />
              <XAxis dataKey="rating" tick={{ fontSize: 10, fill: "#555" }} />
              <YAxis tick={{ fontSize: 10, fill: "#555" }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#F5E6C8", border: "1px solid #5C4033", borderRadius: "0.375rem", fontSize: "0.75rem" }} />
              <Bar dataKey="count" fill="#2D5016" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    const data = (question.options ?? []).map((opt) => ({
      option: opt,
      count: values.filter((v) => v === opt).length,
    }));
    return (
      <div>
        <p className="text-sm font-semibold text-bark-brown mb-2">{question.prompt}</p>
        {values.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(100, data.length * 36)}>
            <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8D5A8" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#555" }} />
              <YAxis type="category" dataKey="option" width={140} tick={{ fontSize: 11, fill: "#555" }} />
              <Tooltip contentStyle={{ backgroundColor: "#F5E6C8", border: "1px solid #5C4033", borderRadius: "0.375rem", fontSize: "0.75rem" }} />
              <Bar dataKey="count" fill="#2D5016" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-iron-grey">No answers yet.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-bark-brown mb-2">{question.prompt}</p>
      {values.length === 0 ? (
        <p className="text-xs text-iron-grey">No answers yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {values.map((v, i) => (
            <li key={i} className="text-sm text-bark-brown bg-parchment-dark/40 rounded-md px-3 py-1.5">{String(v)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
