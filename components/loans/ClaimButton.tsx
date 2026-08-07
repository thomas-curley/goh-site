"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function ClaimButton({ loanId }: { loanId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaim = async () => {
    if (!confirm("Claim this loan? You're volunteering to lend against the collateral listed -- coordinate the trade with the borrower over Discord.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/loans/${loanId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.refresh();
    } else {
      setError(data.error ?? "Failed to claim this loan.");
      setBusy(false);
    }
  };

  return (
    <div>
      <Button size="sm" onClick={handleClaim} disabled={busy}>
        {busy ? "Claiming..." : "Claim This Loan"}
      </Button>
      {error && <p className="text-xs text-red-accent mt-1">{error}</p>}
    </div>
  );
}
