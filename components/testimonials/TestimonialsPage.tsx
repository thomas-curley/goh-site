"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import type { EligibilityResult } from "@/lib/clan-access";
import type { Testimonial } from "@/lib/testimonials";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export function TestimonialsPage({
  eligibility,
  myTestimonial,
  approved,
}: {
  eligibility: EligibilityResult;
  myTestimonial: Testimonial | null;
  approved: Testimonial[];
}) {
  const router = useRouter();
  const [rating, setRating] = useState(myTestimonial?.rating ?? 5);
  const [message, setMessage] = useState(myTestimonial?.message ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setStatus(null);

    const res = await fetch("/api/testimonials/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, message }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setStatus(myTestimonial ? "Updated! It'll need admin approval again before it's public." : "Submitted! It'll show here once an admin approves it.");
      router.refresh();
    } else {
      setError(data.error ?? "Failed to save.");
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete your testimonial? This can't be undone.")) return;
    setDeleting(true);
    const res = await fetch("/api/testimonials/me", { method: "DELETE" });
    if (res.ok) {
      setMessage("");
      setRating(5);
      router.refresh();
    } else {
      setError("Failed to delete your testimonial.");
    }
    setDeleting(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Testimonials</h1>
      <p className="text-bark-brown-light mb-10">
        What clan members say about Gn0me Home. Been here a while? Leave your own below.
      </p>

      <Card hover={false} className="mb-10">
        {!eligibility.eligible ? (
          <div className="text-center py-4">
            <p className="text-bark-brown-light mb-4">{eligibility.reason}</p>
            {eligibility.reason?.includes("signed in") ? (
              <Link href="/login" className="text-sm text-gnome-green hover:underline">Log in →</Link>
            ) : eligibility.reason?.includes("Link and verify") ? (
              <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account →</Link>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="font-display text-lg text-bark-brown">
              {myTestimonial ? "Edit Your Testimonial" : "Leave a Testimonial"}
            </h2>

            {error && <div className="p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>}
            {status && <div className="p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>}

            {myTestimonial?.status === "pending" && (
              <p className="text-xs text-gold">Your testimonial is awaiting admin approval.</p>
            )}
            {myTestimonial?.status === "rejected" && (
              <p className="text-xs text-red-accent">
                Your last submission wasn&apos;t approved{myTestimonial.review_notes ? `: ${myTestimonial.review_notes}` : "."} Feel free to edit and resubmit.
              </p>
            )}

            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Your Rating</label>
              <StarRating value={rating} onChange={setRating} size="lg" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Your Testimonial</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                maxLength={1000}
                placeholder="Tell prospective members what it's like being in Gn0me Home..."
                className={inputClass}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting || !message.trim()}>
                {submitting ? "Saving..." : myTestimonial ? "Update Testimonial" : "Submit Testimonial"}
              </Button>
              {myTestimonial && (
                <button type="button" onClick={handleDelete} disabled={deleting} className="text-sm text-red-accent hover:underline cursor-pointer">
                  {deleting ? "Deleting..." : "Delete my testimonial"}
                </button>
              )}
            </div>
          </form>
        )}
      </Card>

      {approved.length === 0 ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light">No testimonials yet -- be the first!</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {approved.map((t) => (
            <Card key={t.id} hover={false}>
              <div className="flex items-center justify-between gap-4 mb-2">
                <p className="font-mono font-semibold text-bark-brown">{t.rsn}</p>
                <StarRating value={t.rating} readOnly size="sm" />
              </div>
              <p className="text-sm text-bark-brown-light whitespace-pre-wrap mb-2">{t.message}</p>
              <p className="text-xs text-iron-grey">{new Date(t.created_at).toLocaleDateString()}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
