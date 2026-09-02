"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface LinkApproveFormProps {
  code: string;
}

/** The single Approve click that binds a RuneLite pairing code to the signed-in account. */
export function LinkApproveForm({ code }: LinkApproveFormProps) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setState("working");
    setError(null);
    try {
      const res = await fetch("/api/plugin/link/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't approve that code.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Something went wrong. Try again.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="text-center">
        <p className="text-gnome-green font-display text-lg mb-1">Linked!</p>
        <p className="text-sm text-bark-brown-light">
          You can close this tab and go back to RuneLite -- the plugin will finish connecting on its own within a few seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Button size="lg" className="w-full" disabled={state === "working"} onClick={approve}>
        {state === "working" ? "Approving..." : "Approve this RuneLite client"}
      </Button>
      {error && <p className="text-red-accent text-sm mt-3">{error}</p>}
    </div>
  );
}
