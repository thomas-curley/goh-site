"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LOAN_STATUS_LABELS, type LoanStatus, type LoanType } from "@/lib/loans";

interface AdminLoan {
  id: string;
  loan_type: LoanType;
  gp_amount: string | null;
  item_description: string | null;
  timeframe: string;
  collateral_offered: string;
  status: LoanStatus;
  created_at: string;
  borrower: { discord_username: string; rsn: string | null } | null;
  lender: { discord_username: string; rsn: string | null } | null;
}

type Tab = LoanStatus | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "claimed", label: "Claimed" },
  { key: "repaid", label: "Repaid" },
  { key: "cancelled", label: "Cancelled" },
];

export default function AdminLoansPage() {
  const [tab, setTab] = useState<Tab>("open");
  const [loans, setLoans] = useState<AdminLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/loans");
    const data = await res.json().catch(() => ({}));
    setLoans(res.ok ? data.loans ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const forceStatus = async (loan: AdminLoan, newStatus: LoanStatus) => {
    if (!confirm(`Force this loan to "${LOAN_STATUS_LABELS[newStatus]}"?`)) return;
    setBusyId(loan.id);
    const res = await fetch(`/api/admin/loans/${loan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setStatus(`Loan set to ${LOAN_STATUS_LABELS[newStatus]}.`);
      await load();
    } else {
      setStatus("Failed to update. Try again.");
    }
    setBusyId(null);
  };

  const visible = tab === "all" ? loans : loans.filter((l) => l.status === tab);

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Loan Board</h1>
      <p className="text-bark-brown-light mb-6">Every loan request on the site, with dispute overrides.</p>

      {status && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {status}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "primary" : "ghost"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <Card hover={false}><p className="text-sm text-iron-grey">Nothing here.</p></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((loan) => {
            const amount = loan.loan_type === "gp" ? loan.gp_amount : loan.item_description;
            const borrower = loan.borrower?.rsn || loan.borrower?.discord_username || "Unknown";
            const lender = loan.lender?.rsn || loan.lender?.discord_username || null;
            return (
              <Card key={loan.id} hover={false}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-bark-brown">
                      {amount} <span className="text-xs text-iron-grey font-normal">· {loan.timeframe}</span>
                    </p>
                    <p className="text-xs text-iron-grey">
                      Borrower: {borrower}{lender && <span> · Lender: {lender}</span>}
                      <span className="ml-2">{new Date(loan.created_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-parchment-dark text-bark-brown font-semibold shrink-0">
                    {LOAN_STATUS_LABELS[loan.status]}
                  </span>
                </div>
                <p className="text-sm text-bark-brown-light mb-3">Collateral: {loan.collateral_offered}</p>
                <div className="flex flex-wrap gap-2">
                  {loan.status !== "cancelled" && (
                    <Button size="sm" variant="ghost" disabled={busyId === loan.id} onClick={() => forceStatus(loan, "cancelled")}>
                      Force Cancel
                    </Button>
                  )}
                  {loan.status === "claimed" && (
                    <Button size="sm" variant="ghost" disabled={busyId === loan.id} onClick={() => forceStatus(loan, "repaid")}>
                      Force Repaid
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
