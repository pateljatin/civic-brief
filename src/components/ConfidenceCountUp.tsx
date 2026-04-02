'use client';

import { useState, useRef, useEffect } from 'react';

interface ConfidenceCountUpProps {
  value: number;
  className?: string;
}

const DURATION_MS = 800;

export default function ConfidenceCountUp({ value, className }: ConfidenceCountUpProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const [displayedValue, setDisplayedValue] = useState(0);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // No IntersectionObserver: show final value immediately (SSR / old browser fallback)
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      setDisplayedValue(clamped);
      return;
    }

    // Respect reduced-motion preference: skip animation
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplayedValue(clamped);
      return;
    }

    const el = spanRef.current;
    if (!el) return;

    let rafId: number;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      // Ease-out cubic: 1 - (1 - progress)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedValue(Math.round(eased * clamped));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.unobserve(el);
          rafId = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, [clamped]);

  return (
    <span aria-label={`${clamped}% confidence`} className={className} ref={spanRef}>
      {displayedValue}%
    </span>
  );
}
