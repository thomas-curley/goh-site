import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StarRating } from "@/components/ui/StarRating";
import type { Testimonial } from "@/lib/testimonials";

/** Shared "what members say" highlight section for the Homepage and About page. Renders nothing if there's nothing featured yet, rather than showing an empty section. */
export function TestimonialsSection({ testimonials, viewAllHref }: { testimonials: Testimonial[]; viewAllHref?: string }) {
  if (testimonials.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-3xl text-gnome-green">What Our Members Say</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm text-gnome-green hover:text-gnome-green-light underline shrink-0">
            View all testimonials →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((t) => (
          <Card key={t.id} className="flex flex-col gap-2">
            <StarRating value={t.rating} readOnly size="sm" />
            <p className="text-sm text-bark-brown-light line-clamp-4">&ldquo;{t.message}&rdquo;</p>
            <p className="text-xs font-mono text-iron-grey mt-auto pt-2">— {t.rsn}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
