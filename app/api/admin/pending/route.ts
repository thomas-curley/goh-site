import { NextResponse } from "next/server";
import { getAdminAccess, hasPermission } from "@/lib/check-permission";
import { getPendingCounts, PENDING_SOURCES, type PendingKey } from "@/lib/admin-pending";

// GET - what's waiting on staff, limited to what the caller can act on --
// feeds the dashboard's "Needs attention" panel.
export async function GET() {
  const access = await getAdminAccess();
  if (!hasPermission(access, "view_admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const counts = await getPendingCounts((permission) => hasPermission(access, permission));
  const items = (Object.keys(counts) as PendingKey[]).map((key) => ({
    key,
    label: PENDING_SOURCES[key].label,
    href: PENDING_SOURCES[key].href,
    count: counts[key] ?? 0,
  }));
  return NextResponse.json({ items });
}
