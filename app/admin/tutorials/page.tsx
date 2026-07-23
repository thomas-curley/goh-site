import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ALL_TOURS } from "@/lib/tours";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tutorials",
  robots: { index: false, follow: false },
};

export default function AdminTutorialsPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Tutorials</h1>
      <p className="text-bark-brown-light mb-6">
        Guided walkthroughs that spotlight the real page as you go — pick one to get started.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ALL_TOURS.map((tour) => (
          <Link key={tour.id} href={`${tour.path}?tour=${tour.id}`}>
            <Card className="h-full">
              <h2 className="font-display text-lg text-gnome-green mb-1">{tour.label}</h2>
              <p className="text-sm text-bark-brown-light">{tour.description}</p>
              <p className="text-xs text-iron-grey mt-3">{tour.steps.length} steps</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
