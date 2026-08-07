import { requireAuth } from "@/lib/auth";
import { MyLoansView } from "@/components/loans/MyLoansView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Loans",
  description: "Loans you've requested and loans you're funding.",
};

export default async function MyLoansPage() {
  await requireAuth("/loans/mine");

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">My Loans</h1>
      <p className="text-bark-brown-light mb-10">Everything you&apos;ve requested and everything you&apos;re funding.</p>
      <MyLoansView />
    </div>
  );
}
