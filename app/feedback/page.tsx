"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { HONEYPOT_FIELD } from "@/lib/spam-guard";

const CATEGORIES = [
  { value: "", label: "General" },
  { value: "suggestion", label: "Suggestion" },
  { value: "bug", label: "Bug Report" },
  { value: "praise", label: "Praise" },
  { value: "other", label: "Other" },
];

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export default function FeedbackPage() {
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category || undefined, message, respondentName, renderedAt, [HONEYPOT_FIELD]: honeypot }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setSubmitted(true);
      setMessage("");
      setRespondentName("");
      setCategory("");
    } else {
      setError(data.error ?? "Failed to submit. Try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-display text-3xl text-gnome-green mb-1">Feedback</h1>
      <p className="text-bark-brown-light mb-6">
        Got a suggestion, a bug to report, or just want to tell us something? Drop it below — anonymous
        unless you&apos;d like us to know who you are.
      </p>

      <Card hover={false} className="mb-10">
        {submitted ? (
          <div className="text-center py-6">
            <p className="font-display text-xl text-bark-brown mb-2">Thanks!</p>
            <p className="text-bark-brown-light mb-4">Your feedback has been sent.</p>
            <Button variant="ghost" size="sm" onClick={() => setSubmitted(false)}>Submit more feedback</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
            {error && (
              <div className="p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} cursor-pointer`}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Message *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                maxLength={2000}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Your RSN or Discord name (optional)</label>
              <input
                type="text"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="Leave blank to stay anonymous"
                className={inputClass}
              />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send Feedback"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
