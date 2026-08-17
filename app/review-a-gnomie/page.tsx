import { GnomieReviewForm } from "@/components/gnomie-reviews/GnomieReviewForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Review a Gn0mie",
  description: "Give a public shoutout to a clan member -- tell us how awesome they are or how they helped you out.",
};

export default function ReviewAGnomiePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-display text-3xl text-gnome-green mb-1">Review a Gn0mie</h1>
      <p className="text-bark-brown-light mb-6">
        Give a shoutout to a clan member -- tell us how awesome they are or how they helped you out. Anonymous
        unless you&apos;d like us to know who you are. An admin reviews every submission before it&apos;s posted.
      </p>

      <div className="mb-10">
        <GnomieReviewForm />
      </div>
    </div>
  );
}
