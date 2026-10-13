import Link from "next/link";
import { Card } from "@/components/ui/Card";

/** Shown instead of a staff-only page to anyone who isn't staff. */
export function StaffOnly({ title, reason }: { title: string; reason?: string }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-display text-4xl text-gnome-green mb-6 text-center">{title}</h1>
      <Card hover={false} className="text-center py-10">
        <p className="text-bark-brown-light mb-4">{reason ?? "This page is only open to staff for now."}</p>
        {reason?.includes("signed in") ? (
          <Link href="/login" className="text-sm text-gnome-green hover:underline">Log in &rarr;</Link>
        ) : reason?.includes("Link and verify") ? (
          <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account &rarr;</Link>
        ) : null}
      </Card>
    </div>
  );
}
