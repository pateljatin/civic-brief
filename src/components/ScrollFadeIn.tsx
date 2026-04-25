'use client';

import { useRef, useEffect } from 'react';

interface ScrollFadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export default function ScrollFadeIn({ children, delay, className }: ScrollFadeInProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (rare): show immediately
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('visible');
      return;
    }

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

  const classes = ['scroll-fade-in', className ?? '']
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
