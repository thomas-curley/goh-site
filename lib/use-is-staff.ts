"use client";

import { useEffect, useState } from "react";

/**
 * Client-side check for whether the signed-in user is currently Staff rank
 * (Oak+) -- used to hide nav links/menu items for non-staff. UI convenience
 * only, not a security boundary: every staff-gated page still runs its own
 * server-side checkClanEligibility(..., "staff", ...) regardless of what
 * this returns.
 */
export function useIsStaff(): boolean {
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/is-staff")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setIsStaff(!!data.isStaff);
      })
      .catch(() => {
        if (!cancelled) setIsStaff(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return isStaff;
}
