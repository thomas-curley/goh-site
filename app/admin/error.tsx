"use client";

import { Button } from "@/components/ui/Button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <h1 className="font-display text-3xl text-gnome-green mb-4">Admin Error</h1>
      <p className="text-bark-brown-light mb-6">
        {error.message === "Supabase not configured"
          ? "The admin panel requires Supabase to be configured. Add your credentials to .env.local."
          : "Something went wrong loading the admin panel. Try again or check your permissions."}
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/")}>
          Go Home
        </Button>
      </div>
    </div>
  );
}
