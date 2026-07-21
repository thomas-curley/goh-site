"use client";

import { useEffect, useState } from "react";
import type { PermissionKey } from "./permissions";

/**
 * Client-side check for a specific permission (page-level gating stays
 * server-side via checkPermission in app/admin/layout.tsx — this is for
 * gating a single action within an already-accessible page). Always check
 * `loading` before `allowed` — otherwise permission-gated UI flashes
 * hidden-then-visible on mount instead of just appearing once resolved.
 */
export function usePermission(permission: PermissionKey): { allowed: boolean; loading: boolean } {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/permissions/check?permission=${permission}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAllowed(!!data.allowed);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [permission]);

  return { allowed, loading };
}
