import { NextResponse } from "next/server";
import { getGroupMembers } from "@/lib/wom";

// Public, read-only clan roster lookup -- just display names, for the
// onboarding RSN-autocomplete field. No auth needed, same trust level as
// the public /members page this data already backs.
export async function GET() {
  const members = await getGroupMembers();
  return NextResponse.json({
    members: members.map((m) => ({ displayName: m.displayName })),
  });
}
