"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { HONEYPOT_FIELD } from "@/lib/spam-guard";
import { HIGHLIGHT_TYPES } from "@/lib/gnomie-reviews";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

export function GnomieReviewForm() {
  const [members, setMembers] = useState<string[]>([]);
  const [targetRsn, setTargetRsn] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightType, setHighlightType] = useState(HIGHLIGHT_TYPES[0].key);
  const [message, setMessage] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/clan-members")
      .then((res) => res.json())
      .then((data) => setMembers((data.members ?? []).map((m: { displayName: string }) => m.displayName)))
      .catch(() => setMembers([]));
  }, []);

  const suggestions = useMemo(() => {
    const q = targetRsn.trim().toLowerCase();
    const matches = q ? members.filter((name) => name.toLowerCase().includes(q)) : members;
    return matches.slice(0, 20);
  }, [targetRsn, members]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/gnomie-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetRsn,
        highlightType,
        message,
        submitterName,
        imageUrls,
        renderedAt,
        [HONEYPOT_FIELD]: honeypot,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setSubmitted(true);
      setTargetRsn("");
      setHighlightType(HIGHLIGHT_TYPES[0].key);
      setMessage("");
      setSubmitterName("");
      setImageUrls([]);
    } else {
      setError(data.error ?? "Failed to submit. Try again.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <Card hover={false} className="text-center py-6">
        <p className="font-display text-xl text-bark-brown mb-2">Thanks!</p>
        <p className="text-bark-brown-light mb-4">Your review is pending admin approval.</p>
        <Button variant="ghost" size="sm" onClick={() => setSubmitted(false)}>Submit another review</Button>
      </Card>
    );
  }

  return (
    <Card hover={false}>
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

        <div className="relative">
          <label className="block text-sm font-semibold text-bark-brown mb-1">Who are you highlighting? *</label>
          <input
            type="text"
            value={targetRsn}
            onChange={(e) => { setTargetRsn(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Their RSN..."
            required
            autoComplete="off"
            className={`${inputClass} font-mono`}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 card-wood py-1 z-10 shadow-xl max-h-48 overflow-y-auto">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={() => { setTargetRsn(name); setShowSuggestions(false); }}
                  className="block w-full text-left px-3 py-1.5 text-sm font-mono text-bark-brown hover:bg-parchment-dark transition-colors cursor-pointer"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-bark-brown mb-2">What kind of shoutout?</label>
          <div className="flex flex-wrap gap-2">
            {HIGHLIGHT_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setHighlightType(t.key)}
                className={`px-3 py-1.5 rounded-md border-2 text-sm font-semibold transition-colors cursor-pointer ${
                  highlightType === t.key
                    ? "bg-gnome-green/15 border-gnome-green text-gnome-green"
                    : "border-bark-brown-light text-bark-brown-light hover:border-gnome-green"
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-bark-brown mb-1">Message *</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            maxLength={1000}
            placeholder="Tell us how awesome they are, or how they helped you out..."
            className={inputClass}
          />
        </div>

        <ImageUploader images={imageUrls} onChange={setImageUrls} maxImages={3} label="Pictures (optional)" />

        <div>
          <label className="block text-sm font-semibold text-bark-brown mb-1">Your RSN or Discord name (optional)</label>
          <input
            type="text"
            value={submitterName}
            onChange={(e) => setSubmitterName(e.target.value)}
            placeholder="Leave blank to stay anonymous"
            className={inputClass}
          />
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Submit Review"}
        </Button>
      </form>
    </Card>
  );
}
