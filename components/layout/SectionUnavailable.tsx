import Link from "next/link";

/** Shown by any public page checkSectionAccess() rejects, matching the style of the admin panel's own "Access Denied" screen. */
export function SectionUnavailable() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-4xl text-gold-display mb-4">Not Available</h1>
      <p className="text-bark-brown-light mb-2">
        This section isn&apos;t available to you right now.
      </p>
      <Link href="/" className="mt-6 text-gnome-green hover:text-gnome-green-light underline">
        Back to Home
      </Link>
    </div>
  );
}
