import type { Metadata } from "next";
import { GalleryView } from "@/components/art/GalleryView";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";

export const metadata: Metadata = {
  title: "Gn0mie Gallery",
  description: "Artwork by members of the clan, from our art contests.",
};

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  if (!(await checkSectionAccess("gallery"))) return <SectionUnavailable />;
  return <GalleryView />;
}
