import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface Testimonial {
  id: string;
  user_id: string;
  rsn: string;
  rating: number;
  message: string;
  status: "pending" | "approved" | "rejected";
  featured: boolean;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

const PUBLIC_SELECT = "id, user_id, rsn, rating, message, status, featured, created_at";

/** Every approved testimonial, newest first -- for the full /testimonials list. */
export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("testimonials")
    .select(PUBLIC_SELECT)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  return (data as Testimonial[] | null) ?? [];
}

/** Approved AND admin-featured testimonials -- for the Homepage/About highlight sections. */
export async function getFeaturedTestimonials(limit = 6): Promise<Testimonial[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("testimonials")
    .select(PUBLIC_SELECT)
    .eq("status", "approved")
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as Testimonial[] | null) ?? [];
}
