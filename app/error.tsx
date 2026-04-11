"use client";

import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="font-display text-5xl text-gold-display mb-4">Oops!</h1>
      <h2 className="font-display text-xl text-gnome-green mb-2">
        Something went wrong
      </h2>
      <p className="text-bark-brown-light mb-6 max-w-md">
        An unexpected error occurred. This might be a temporary issue — try
        refreshing or come back in a moment.
      </p>
      {error.digest && (
        <p className="text-xs text-iron-grey mb-4 font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/")}>
          Go Home
        </Button>
      </div>
    </div>
  );
}
