import { redirect } from "next/navigation";

// Quest events are listed with everything else on the Activities page.
export default function QuestsIndexPage() {
  redirect("/activities");
}
