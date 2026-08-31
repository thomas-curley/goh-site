import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility } from "@/lib/clan-access";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import { getApprovedTestimonials, type Testimonial } from "@/lib/testimonials";
import { TestimonialsPage } from "@/components/testimonials/TestimonialsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Testimonials",
  description: "What clan members say about Gn0me Home.",
};

export const dynamic = "force-dynamic"; // gated per-viewer, can't be statically cached

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function TestimonialsIndexPage() {
  if (!(await checkSectionAccess("testimonials"))) return <SectionUnavailable />;

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const serviceClient = getServiceClient();

  const eligibility = serviceClient
    ? await checkClanEligibility(serviceClient, "verified_player", user?.id ?? null, "testimonials")
    : { eligible: true };

  let myTestimonial: Testimonial | null = null;
  if (serviceClient && user) {
    const { data } = await serviceClient.from("testimonials").select("*").eq("user_id", user.id).maybeSingle();
    myTestimonial = (data as Testimonial | null) ?? null;
  }

  const approved = await getApprovedTestimonials();

  return <TestimonialsPage eligibility={eligibility} myTestimonial={myTestimonial} approved={approved} />;
}
