"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIsStaff } from "@/lib/use-is-staff";
import { WHATS_NEW_EVENT, unseenCount } from "@/lib/whats-new-state";

/** "What's New" account-menu link for staff, with a count of changes they haven't seen yet. Renders nothing for non-staff. */
export function WhatsNewMenuLink({ className, onClick }: { className: string; onClick?: () => void }) {
  const isStaff = useIsStaff();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(unseenCount());
    const frame = requestAnimationFrame(sync);
    window.addEventListener(WHATS_NEW_EVENT, sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(WHATS_NEW_EVENT, sync);
    };
  }, []);

  if (!isStaff) return null;
  return (
    <Link href="/whats-new" onClick={onClick} className={`${className} flex items-center justify-between gap-2`}>
      <span>What&apos;s New</span>
      {count > 0 && (
        <span className="min-w-5 px-1.5 rounded-full bg-red-accent text-white text-[11px] font-semibold leading-5 text-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
