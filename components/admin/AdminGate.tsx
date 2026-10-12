import { getAdminAccess, hasPermission } from "@/lib/check-permission";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

/**
 * Server-side gate for one admin section. The admin layout only checks
 * view_admin, and Next keeps that layout mounted across client-side
 * navigation -- so each section has its own tiny layout.tsx wrapping its
 * pages in this, which re-runs whenever someone navigates into the section.
 */
export async function AdminGate({ permission, children }: { permission: PermissionKey; children: React.ReactNode }) {
  const access = await getAdminAccess();
  if (hasPermission(access, permission)) return <>{children}</>;

  return (
    <div className="py-16 text-center">
      <h1 className="font-display text-3xl text-gold-display mb-3">No Access</h1>
      <p className="text-bark-brown-light">
        This page needs the &quot;{PERMISSIONS[permission].label}&quot; permission, which your rank doesn&apos;t have.
      </p>
    </div>
  );
}
