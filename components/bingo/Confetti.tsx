"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#3E7D2A", "#DAA520", "#F5E6C8", "#B5462E", "#2E64A8", "#6BBF3B"];

/** A short confetti burst over the page; does nothing with reduced motion on. */
export function Confetti({ fire }: { fire: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire || !canvas.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = canvas.current;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    el.width = window.innerWidth;
    el.height = window.innerHeight;
    const pieces = Array.from({ length: 140 }, () => ({
      x: el.width / 2 + (Math.random() - 0.5) * el.width * 0.3,
      y: el.height * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      size: 5 + Math.random() * 6,
      spin: Math.random() * Math.PI,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let frame = 0;
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, el.width, el.height);
      for (const p of pieces) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += 0.15;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (++frame < 180) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, el.width, el.height);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);

  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-50" aria-hidden />;
}
