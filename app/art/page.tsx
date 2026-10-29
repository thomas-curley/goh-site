import { redirect } from "next/navigation";

// Art contests are listed with everything else on the Activities page.
export default function ArtIndexPage() {
  redirect("/activities");
}
