import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="font-display text-6xl text-gold-display mb-4">404</h1>
      <h2 className="font-display text-2xl text-gnome-green mb-2">
        Page Not Found
      </h2>
      <p className="text-bark-brown-light mb-8 max-w-md">
        Looks like you wandered into the wrong part of the Gnome Stronghold.
        This page doesn&apos;t exist.
      </p>
      <Link href="/">
        <Button>Return Home</Button>
      </Link>
    </div>
  );
}
