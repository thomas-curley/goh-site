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
  purpose: string | null;
  collateral_offered: string;
  collateral_value: string | null;
  previous_loans: string | null;
  repayment_plan: string | null;
  additional_notes: string | null;
  agreed_terms: boolean;
  admin_note: string | null;
  status: LoanStatus;
  created_at: string;
  claimed_at: string | null;
  repaid_at: string | null;
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

const detailLabel = "text-xs font-semibold text-bark-brown";

export default function AdminLoansPage() {
  const [tab, setTab] = useState<Tab>("open");
  const [loans, setLoans] = useState<AdminLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/loans");
    const data = await res.json().catch(() => ({}));
    setLoans(res.ok ? data.loans ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const forceStatus = async (loan: AdminLoan, newStatus: LoanStatus, note?: string) => {
    if (newStatus !== "cancelled" && !confirm(`Force this loan to "${LOAN_STATUS_LABELS[newStatus]}"?`)) return;
    setBusyId(loan.id);
    const res = await fetch(`/api/admin/loans/${loan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, ...(note !== undefined ? { note } : {}) }),
    });
    if (res.ok) {
      setStatus(`Loan set to ${LOAN_STATUS_LABELS[newStatus]}.`);
      setCancelingId(null);
      setCancelNote("");
      await load();
    } else {
      setStatus("Failed to update. Try again.");
    }
    setBusyId(null);
  };

  const startCancel = (loanId: string) => {
    setCancelingId(loanId);
    setCancelNote("");
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
            const expanded = expandedId === loan.id;
            const canceling = cancelingId === loan.id;
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

                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : loan.id)}
                  className="text-xs text-gnome-green hover:underline cursor-pointer mb-3"
                >
                  {expanded ? "Hide details" : "View details"}
                </button>

                {expanded && (
                  <div className="mb-4 p-3 rounded-md bg-parchment-dark space-y-2 text-sm text-bark-brown-light">
                    {loan.purpose && <p><span className={detailLabel}>Purpose:</span> {loan.purpose}</p>}
                    {loan.collateral_value && <p><span className={detailLabel}>Estimated Collateral Value:</span> {loan.collateral_value}</p>}
                    {loan.previous_loans && <p><span className={detailLabel}>Previous Loans:</span> {loan.previous_loans}</p>}
                    {loan.repayment_plan && <p><span className={detailLabel}>Repayment Plan:</span> {loan.repayment_plan}</p>}
                    {loan.additional_notes && <p><span className={detailLabel}>Additional Notes:</span> {loan.additional_notes}</p>}
                    <p><span className={detailLabel}>Terms Agreed:</span> {loan.agreed_terms ? "Yes" : "No"}</p>
                    {loan.claimed_at && <p><span className={detailLabel}>Claimed:</span> {new Date(loan.claimed_at).toLocaleString()}</p>}
                    {loan.repaid_at && <p><span className={detailLabel}>Repaid:</span> {new Date(loan.repaid_at).toLocaleString()}</p>}
                    {loan.admin_note && (
                      <p className="pt-2 border-t border-bark-brown-light/30">
                        <span className={detailLabel}>Staff Note:</span> {loan.admin_note}
                      </p>
                    )}
                  </div>
                )}

                {canceling ? (
                  <div className="p-3 rounded-md border border-red-accent/30 bg-red-accent/5 space-y-2">
                    <label className="block text-xs font-semibold text-bark-brown">Reason (optional, visible to staff)</label>
                    <textarea
                      value={cancelNote}
                      onChange={(e) => setCancelNote(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green resize-y"
                      placeholder="Why is this loan being cancelled?"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busyId === loan.id} onClick={() => forceStatus(loan, "cancelled", cancelNote)}>
                        {busyId === loan.id ? "Cancelling..." : "Confirm Cancel"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCancelingId(null)}>Nevermind</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {loan.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" disabled={busyId === loan.id} onClick={() => startCancel(loan.id)}>
                        Force Cancel
                      </Button>
                    )}
                    {loan.status === "claimed" && (
                      <Button size="sm" variant="ghost" disabled={busyId === loan.id} onClick={() => forceStatus(loan, "repaid")}>
                        Force Repaid
                      </Button>
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
