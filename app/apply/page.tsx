"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { STAFF_APPLICATION_QUESTIONS } from "@/lib/staff-application-questions";
import type { User } from "@supabase/supabase-js";

interface ExistingApplication {
  id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  review_notes: string | null;
}

const STATUS_COPY: Record<ExistingApplication["status"], { title: string; body: string }> = {
  pending: {
    title: "Application pending",
    body: "Your staff application is in the queue for review. We'll let you know once a decision is made.",
  },
  accepted: {
    title: "Application accepted",
    body: "Your staff application was accepted. Reach out in Discord if you haven't already been onboarded.",
  },
  rejected: {
    title: "Application not accepted this time",
    body: "Your last staff application wasn't accepted. You're welcome to apply again in the future.",
  },
};

export default function ApplyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [existing, setExisting] = useState<ExistingApplication | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExisting = useCallback(async () => {
    setLoadingExisting(true);
    try {
      const res = await fetch("/api/staff-applications/mine");
      const data = await res.json();
      setExisting(res.ok ? data.application : null);
    } catch {
      setExisting(null);
    } finally {
      setLoadingExisting(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function checkAuth() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted) setUser(user);
      } catch {
        // Supabase not configured
      } finally {
        if (mounted) setAuthLoaded(true);
      }
    }
    checkAuth();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (user) loadExisting();
    else setLoadingExisting(false);
  }, [user, loadExisting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/staff-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError(data.error ?? "Failed to submit your application. Try again.");
    }
    setSubmitting(false);
  };

  if (!authLoaded || loadingExisting) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-display text-3xl text-gnome-green mb-4">Apply for Staff</h1>
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light mb-4">Log in with Discord to apply for a staff role.</p>
          <Link
            href="/login?redirect=/apply"
            className="inline-flex items-center justify-center font-body font-semibold rounded-md transition-colors duration-200 bg-gnome-green text-text-light hover:bg-gnome-green-light px-5 py-2.5 text-base"
          >
            Log In
          </Link>
        </Card>
      </div>
    );
  }

  if (existing && existing.status === "pending") {
    const copy = STATUS_COPY[existing.status];
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-display text-3xl text-gnome-green mb-4">Apply for Staff</h1>
        <Card hover={false} className="text-center py-10">
          <p className="font-display text-xl text-bark-brown mb-2">{copy.title}</p>
          <p className="text-bark-brown-light">{copy.body}</p>
          <p className="text-xs text-iron-grey mt-4">
            Submitted {new Date(existing.created_at).toLocaleDateString()}
          </p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-display text-3xl text-gnome-green mb-4">Apply for Staff</h1>
        <Card hover={false} className="text-center py-10">
          <p className="font-display text-xl text-bark-brown mb-2">Application submitted</p>
          <p className="text-bark-brown-light">
            Thanks for applying — staff will review it and get back to you.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-display text-3xl text-gnome-green mb-1">Apply for Staff</h1>
      <p className="text-bark-brown-light mb-6">
        Interested in helping run the clan? Answer a few questions below and staff will review your application.
      </p>

      {existing && existing.status !== "pending" && (
        <Card hover={false} className="mb-6">
          <p className="text-sm text-bark-brown">{STATUS_COPY[existing.status].title}</p>
          <p className="text-xs text-iron-grey mt-1">{STATUS_COPY[existing.status].body}</p>
        </Card>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {STAFF_APPLICATION_QUESTIONS.map((q) => (
          <div key={q.key}>
            <label className="block text-sm font-semibold text-bark-brown mb-1">
              {q.label}{q.key !== "other" && <span className="text-red-accent"> *</span>}
            </label>
            <textarea
              value={answers[q.key] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
              rows={3}
              maxLength={1000}
              required={q.key !== "other"}
              className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green"
            />
          </div>
        ))}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Application"}
        </Button>
      </form>
    </div>
  );
}
