'use client';

import { useRef, useEffect } from 'react';

interface ScrollFadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export default function ScrollFadeIn({ children, delay, className }: ScrollFadeInProps) {
  const ref = useRef<HTMLDivElement>(null);

  // SSR / no-IntersectionObserver: render visible immediately
  const noIO = typeof IntersectionObserver === 'undefined';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('visible');
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const classes = ['scroll-fade-in', noIO ? 'visible' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={classes}
      style={delay !== undefined ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
