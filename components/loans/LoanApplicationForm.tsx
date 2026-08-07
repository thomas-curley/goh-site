"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LOAN_TIMEFRAMES, LOAN_PURPOSES, PREVIOUS_LOAN_OPTIONS, type LoanType } from "@/lib/loans";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";
const labelClass = "block text-sm font-semibold text-bark-brown mb-1";

export function LoanApplicationForm({ verifiedName }: { verifiedName: string }) {
  const [loanType, setLoanType] = useState<LoanType>("gp");
  const [gpAmount, setGpAmount] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [purpose, setPurpose] = useState("");
  const [collateralOffered, setCollateralOffered] = useState("");
  const [collateralValue, setCollateralValue] = useState("");
  const [previousLoans, setPreviousLoans] = useState<string>(PREVIOUS_LOAN_OPTIONS[0]);
  const [repaymentPlan, setRepaymentPlan] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loanType,
        gpAmount,
        itemDescription,
        timeframe,
        purpose: purpose || undefined,
        collateralOffered,
        collateralValue: collateralValue || undefined,
        previousLoans,
        repaymentPlan: repaymentPlan || undefined,
        additionalNotes: additionalNotes || undefined,
        agreedTerms,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError(data.error ?? "Failed to submit your request.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <Card hover={false} className="text-center py-10">
        <p className="font-display text-xl text-bark-brown mb-2">Request submitted!</p>
        <p className="text-bark-brown-light mb-4">Your loan request is live on the board.</p>
        <Link href="/loans/mine" className="text-sm text-gnome-green hover:underline">View My Loans →</Link>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card hover={false}>
        <p className="text-sm text-bark-brown">
          Submitting as <span className="font-semibold">{verifiedName}</span>
        </p>
      </Card>

      {error && (
        <div className="p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">
          {error}
        </div>
      )}

      <Card hover={false} className="space-y-4">
        <div>
          <label className={labelClass}>Loan Type *</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLoanType("gp")}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold border-2 transition-colors cursor-pointer ${
                loanType === "gp" ? "bg-gnome-green border-gnome-green text-text-light" : "border-bark-brown-light text-bark-brown hover:border-gnome-green"
              }`}
            >
              Gold Pieces (GP)
            </button>
            <button
              type="button"
              onClick={() => setLoanType("item")}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold border-2 transition-colors cursor-pointer ${
                loanType === "item" ? "bg-gnome-green border-gnome-green text-text-light" : "border-bark-brown-light text-bark-brown hover:border-gnome-green"
              }`}
            >
              Item
            </button>
          </div>
        </div>

        {loanType === "gp" ? (
          <div>
            <label className={labelClass}>GP Amount *</label>
            <input type="text" value={gpAmount} onChange={(e) => setGpAmount(e.target.value)} required className={inputClass} placeholder="e.g. 50M, 100K" />
            <p className="text-xs text-iron-grey mt-1">Use K, M, B notation.</p>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Item Requested *</label>
            <input type="text" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} required className={inputClass} placeholder="e.g. Dragon Claws" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Timeframe *</label>
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} required className={`${inputClass} cursor-pointer`}>
              <option value="" disabled>Select timeframe...</option>
              {LOAN_TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Purpose</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${inputClass} cursor-pointer`}>
              <option value="">Select purpose...</option>
              {LOAN_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Collateral Offered *</label>
          <textarea
            value={collateralOffered}
            onChange={(e) => setCollateralOffered(e.target.value)}
            required
            rows={3}
            maxLength={500}
            className={`${inputClass} resize-y`}
            placeholder="List items/GP you'll put up as collateral, e.g. Dragon Claws + 10M GP"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Estimated Collateral Value</label>
            <input type="text" value={collateralValue} onChange={(e) => setCollateralValue(e.target.value)} className={inputClass} placeholder="e.g. 75M" />
          </div>
          <div>
            <label className={labelClass}>Previous Loans With Us?</label>
            <select value={previousLoans} onChange={(e) => setPreviousLoans(e.target.value)} className={`${inputClass} cursor-pointer`}>
              {PREVIOUS_LOAN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Repayment Plan</label>
          <textarea
            value={repaymentPlan}
            onChange={(e) => setRepaymentPlan(e.target.value)}
            rows={3}
            maxLength={500}
            className={`${inputClass} resize-y`}
            placeholder="How do you plan to repay? e.g. 10M/day from Vorkath farming"
          />
        </div>

        <div>
          <label className={labelClass}>Additional Notes</label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            className={`${inputClass} resize-y`}
            placeholder="Anything else we should know?"
          />
        </div>
      </Card>

      <Card hover={false}>
        <label className="flex items-start gap-3 text-sm text-bark-brown-light cursor-pointer">
          <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} required className="mt-0.5 accent-gnome-green" />
          <span>
            I have read and agree to the Terms of Service. I understand that failure to repay my loan, evasion of
            contact, or any attempt to avoid my repayment obligations may result in forfeiture of my collateral,
            reporting to leadership with full supporting documentation, community disclosure, and permanent removal
            from clan lending services.
          </span>
        </label>
      </Card>

      <Button type="submit" size="lg" disabled={submitting || !agreedTerms}>
        {submitting ? "Submitting..." : "Submit Application"}
      </Button>
    </form>
  );
}
