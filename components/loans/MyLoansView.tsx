"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LOAN_STATUS_LABELS, type LoanStatus, type LoanType } from "@/lib/loans";

interface LoanWithParties {
  id: string;
  loan_type: LoanType;
  gp_amount: string | null;
  item_description: string | null;
  timeframe: string;
  collateral_offered: string;
  status: LoanStatus;
  borrower: { discord_username: string; rsn: string | null } | null;
  lender: { discord_username: string; rsn: string | null } | null;
}

const STATUS_BADGE: Record<LoanStatus, string> = {
  open: "bg-gnome-green/10 text-gnome-green",
  claimed: "bg-gold/20 text-bark-brown",
  repaid: "bg-iron-grey/10 text-iron-grey",
  cancelled: "bg-red-accent/10 text-red-accent",
};

function LoanRow({ loan, counterpartLabel, counterpartName, onAction }: {
  loan: LoanWithParties;
  counterpartLabel: string;
  counterpartName: string | null;
  onAction: (id: string, action: "cancel" | "repay") => void;
}) {
  const amount = loan.loan_type === "gp" ? loan.gp_amount : loan.item_description;

  return (
    <Card hover={false}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="font-display text-lg text-bark-brown">{amount}</p>
          <p className="text-xs text-iron-grey">{loan.timeframe} · {counterpartLabel}: {counterpartName ?? "—"}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-semibold shrink-0 ${STATUS_BADGE[loan.status]}`}>
          {LOAN_STATUS_LABELS[loan.status]}
        </span>
      </div>
      <p className="text-sm text-bark-brown-light mb-3">Collateral: {loan.collateral_offered}</p>
      <div className="flex gap-2">
        {loan.status === "open" && (
          <Button size="sm" variant="ghost" onClick={() => onAction(loan.id, "cancel")}>Cancel Request</Button>
        )}
        {loan.status === "claimed" && (
          <Button size="sm" variant="ghost" onClick={() => onAction(loan.id, "repay")}>Mark Repaid</Button>
        )}
      </div>
    </Card>
  );
}

export function MyLoansView() {
  const [requested, setRequested] = useState<LoanWithParties[]>([]);
  const [funding, setFunding] = useState<LoanWithParties[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/loans/mine");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setRequested(data.requested ?? []);
      setFunding(data.funding ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: "cancel" | "repay") => {
    const confirmMsg = action === "cancel" ? "Cancel this loan request?" : "Mark this loan as repaid?";
    if (!confirm(confirmMsg)) return;
    setError(null);
    const res = await fetch(`/api/loans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await load();
    } else {
      setError(data.error ?? "Failed to update this loan.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {error && (
        <div className="p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">
          {error}
        </div>
      )}

      <section>
        <h2 className="font-display text-2xl text-gnome-green mb-4">Requested by Me</h2>
        {requested.length === 0 ? (
          <Card hover={false}><p className="text-sm text-iron-grey">You haven&apos;t requested any loans yet.</p></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {requested.map((loan) => (
              <LoanRow
                key={loan.id}
                loan={loan}
                counterpartLabel="Lender"
                counterpartName={loan.lender?.rsn || loan.lender?.discord_username || null}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl text-gnome-green mb-4">Funding</h2>
        {funding.length === 0 ? (
          <Card hover={false}><p className="text-sm text-iron-grey">You haven&apos;t claimed any loans yet.</p></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {funding.map((loan) => (
              <LoanRow
                key={loan.id}
                loan={loan}
                counterpartLabel="Borrower"
                counterpartName={loan.borrower?.rsn || loan.borrower?.discord_username || null}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
