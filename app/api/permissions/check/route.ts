import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

// GET - check whether the current user has a given permission. Used by
// client components that need to gate a specific action (not a whole page —
// page-level gating stays server-side in app/admin/layout.tsx).
export async function GET(request: NextRequest) {
  const permission = request.nextUrl.searchParams.get("permission");
  if (!permission || !(permission in PERMISSIONS)) {
    return NextResponse.json({ error: "Unknown permission" }, { status: 400 });
  }

  const { allowed } = await checkPermission(permission as PermissionKey);
  return NextResponse.json({ allowed });
}
