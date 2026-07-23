"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { TourDefinition } from "@/lib/tours";

const PAD = 8;
const POLL_MS = 300;

interface PageTourProps {
  tour: TourDefinition;
}

/**
 * Self-contained per-page spotlight walkthrough. Renders nothing unless the
 * ?tour= query param matches this page's own tour id. No global state/
 * context — each admin page that has a tour mounts its own <PageTour>.
 */
export function PageTour({ tour }: PageTourProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [active, setActive] = useState(() => searchParams.get("tour") === tour.id);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrolledStepRef = useRef(-1);

  // Strip ?tour= immediately so a later refresh or back-navigation to this
  // URL doesn't silently re-launch a tour the admin already finished/exited.
  useEffect(() => {
    if (active) {
      router.replace(pathname, { scroll: false });
    }
    // Only ever run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Core loop: always re-query the DOM fresh so a target that appears OR
  // disappears mid-tour (editing state hiding fields, a child component
  // unmounting) is picked up on the very next tick — never cache the node.
  useEffect(() => {
    if (!active) return;
    const step = tour.steps[stepIndex];
    if (!step) return;

    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        if (scrolledStepRef.current !== stepIndex) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          scrolledStepRef.current = stepIndex;
        }
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    window.addEventListener("resize", tick);
    window.addEventListener("scroll", tick, true);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", tick);
      window.removeEventListener("scroll", tick, true);
    };
  }, [active, stepIndex, tour.steps]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const exitTour = () => setActive(false);
  const next = () => {
    if (stepIndex === tour.steps.length - 1) {
      exitTour();
    } else {
      setStepIndex((i) => i + 1);
    }
  };
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  if (!active || typeof document === "undefined") return null;

  const step = tour.steps[stepIndex];
  if (!step) return null;

  let bandGeometry: { top: number; bottom: number; left: number; right: number } | null = null;
  if (rect) {
    bandGeometry = {
      top: Math.max(0, rect.top - PAD),
      bottom: Math.min(window.innerHeight, rect.bottom + PAD),
      left: Math.max(0, rect.left - PAD),
      right: Math.min(window.innerWidth, rect.right + PAD),
    };
  }

  const centered = !rect;
  let tooltipStyle: React.CSSProperties | undefined;
  if (rect) {
    const placement = step.placement ?? (rect.bottom > window.innerHeight * 0.75 ? "top" : "bottom");
    const clampedLeft = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 336));
    if (placement === "bottom") {
      tooltipStyle = { top: rect.bottom + PAD, left: clampedLeft };
    } else if (placement === "top") {
      tooltipStyle = { bottom: window.innerHeight - rect.top + PAD, left: clampedLeft };
    } else if (placement === "left") {
      tooltipStyle = { right: window.innerWidth - rect.left + PAD, top: Math.min(rect.top, window.innerHeight - 200) };
    } else {
      tooltipStyle = { left: rect.right + PAD, top: Math.min(rect.top, window.innerHeight - 200) };
    }
  }

  return createPortal(
    <>
      {bandGeometry && (
        <>
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, right: 0, height: bandGeometry.top, zIndex: 100 }} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: bandGeometry.bottom, left: 0, right: 0, bottom: 0, zIndex: 100 }} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: bandGeometry.top, height: bandGeometry.bottom - bandGeometry.top, left: 0, width: bandGeometry.left, zIndex: 100 }} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: bandGeometry.top, height: bandGeometry.bottom - bandGeometry.top, left: bandGeometry.right, right: 0, zIndex: 100 }} />
          <div
            className="fixed pointer-events-none border-2 border-gold-display rounded-md"
            style={{
              top: bandGeometry.top,
              left: bandGeometry.left,
              width: bandGeometry.right - bandGeometry.left,
              height: bandGeometry.bottom - bandGeometry.top,
              boxShadow: "0 0 12px 2px rgba(218,165,32,0.6)",
              zIndex: 101,
            }}
          />
        </>
      )}

      <div
        className={`fixed z-[102] w-80 max-w-[calc(100vw-2rem)] card-wood p-4 ${centered ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" : ""}`}
        style={tooltipStyle}
        role="dialog"
        aria-live="polite"
        aria-label={`${step.title} — step ${stepIndex + 1} of ${tour.steps.length}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs text-iron-grey">Step {stepIndex + 1} of {tour.steps.length}</span>
          <button
            type="button"
            onClick={exitTour}
            aria-label="Exit tour"
            className="text-iron-grey hover:text-bark-brown cursor-pointer leading-none"
          >
            ✕
          </button>
        </div>
        <h4 className="font-display text-base text-gnome-green mb-1">{step.title}</h4>
        <p className="text-sm text-bark-brown-light mb-3">{step.body}</p>
        {!rect && (
          <p className="text-xs text-iron-grey italic mb-3">
            Waiting for you to do that — or click Next to continue anyway.
          </p>
        )}
        <div className="flex items-center gap-3">
          {stepIndex > 0 && (
            <button type="button" onClick={back} className="text-xs text-bark-brown hover:underline cursor-pointer">
              Back
            </button>
          )}
          <button type="button" onClick={exitTour} className="text-xs text-iron-grey hover:underline cursor-pointer">
            Skip tour
          </button>
          <Button type="button" size="sm" onClick={next} className="ml-auto">
            {stepIndex === tour.steps.length - 1 ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
