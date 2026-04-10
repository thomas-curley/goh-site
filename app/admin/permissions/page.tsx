"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PERMISSIONS, ASSIGNABLE_ROLES, type PermissionKey } from "@/lib/permissions";

interface RolePermission {
  id: string;
  role: string;
  permission: string;
  granted: boolean;
}

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const loadPermissions = useCallback(async () => {
    const { data } = await supabase
      .from("role_permissions")
      .select("*")
      .order("role");

    if (data) setPermissions(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const isGranted = (role: string, permission: string): boolean => {
    const entry = permissions.find(
      (p) => p.role === role && p.permission === permission
    );
    return entry?.granted ?? false;
  };

  const togglePermission = async (role: string, permission: string) => {
    setSaving(true);
    setStatus(null);

    const existing = permissions.find(
      (p) => p.role === role && p.permission === permission
    );

    if (existing) {
      // Toggle existing
      await supabase
        .from("role_permissions")
        .update({ granted: !existing.granted, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      // Create new entry (granting)
      await supabase
        .from("role_permissions")
        .insert({ role, permission, granted: true });
    }

    await loadPermissions();
    setStatus(`Updated ${role} → ${permission}`);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  const permissionKeys = Object.keys(PERMISSIONS) as PermissionKey[];
  // Sort roles highest first
  const sortedRoles = [...ASSIGNABLE_ROLES].sort((a, b) => b.order - a.order);

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-2">Permissions</h1>
      <p className="text-sm text-bark-brown-light mb-6">
        Configure which clan ranks can access each feature. Members must have their RSN
        linked to get their rank detected.
      </p>

      {status && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {status}
        </div>
      )}

      {/* Desktop table */}
      <Card hover={false} className="overflow-x-auto hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bark-brown-light">
              <th className="text-left py-3 pr-4 text-iron-grey font-semibold">Rank</th>
              {permissionKeys.map((perm) => (
                <th
                  key={perm}
                  className="text-center py-3 px-2 text-iron-grey font-semibold"
                  title={PERMISSIONS[perm].description}
                >
                  <div className="text-xs leading-tight">
                    {PERMISSIONS[perm].label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRoles.map((role) => (
              <tr key={role.key} className="border-b border-parchment-dark last:border-0">
                <td className="py-3 pr-4">
                  <span className="font-semibold text-bark-brown">{role.name}</span>
                </td>
                {permissionKeys.map((perm) => {
                  const granted = isGranted(role.key, perm);
                  return (
                    <td key={perm} className="text-center py-3 px-2">
                      <button
                        onClick={() => togglePermission(role.key, perm)}
                        disabled={saving}
                        className={`w-8 h-8 rounded-md border-2 transition-colors cursor-pointer inline-flex items-center justify-center ${
                          granted
                            ? "bg-gnome-green border-gnome-green"
                            : "bg-transparent border-bark-brown-light hover:border-gnome-green"
                        }`}
                        title={`${granted ? "Revoke" : "Grant"} "${PERMISSIONS[perm].label}" for ${role.name}`}
                      >
                        {granted && (
                          <svg className="w-4 h-4 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {sortedRoles.map((role) => (
          <Card key={role.key} hover={false}>
            <h3 className="font-display text-lg text-bark-brown mb-3">{role.name}</h3>
            <div className="space-y-2">
              {permissionKeys.map((perm) => {
                const granted = isGranted(role.key, perm);
                return (
                  <button
                    key={perm}
                    onClick={() => togglePermission(role.key, perm)}
                    disabled={saving}
                    className="w-full flex items-center justify-between py-2 px-3 rounded-md hover:bg-parchment-dark transition-colors cursor-pointer"
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold text-bark-brown">{PERMISSIONS[perm].label}</p>
                      <p className="text-xs text-iron-grey">{PERMISSIONS[perm].description}</p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded border-2 shrink-0 ml-3 flex items-center justify-center ${
                        granted
                          ? "bg-gnome-green border-gnome-green"
                          : "border-bark-brown-light"
                      }`}
                    >
                      {granted && (
                        <svg className="w-3 h-3 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Info */}
      <Card hover={false} className="mt-6 bg-parchment-dark">
        <h3 className="font-display text-base text-bark-brown mb-2">How permissions work</h3>
        <ul className="space-y-1 text-xs text-bark-brown-light">
          <li>• Ranks are detected from WOM when a user links their RSN</li>
          <li>• WOM &quot;Owner&quot; and &quot;Summoner&quot; roles map to &quot;Council Member&quot;</li>
          <li>• Users without a linked RSN have no rank-based permissions</li>
          <li>• Only Council Members can access this permissions page</li>
        </ul>
      </Card>
    </div>
  );
}
