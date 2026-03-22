import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfidenceCountUp from '@/components/ConfidenceCountUp';

// Default: mock IntersectionObserver so the component mounts without throwing.
// Individual tests override this as needed.
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
  // Default: animation is allowed
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConfidenceCountUp', () => {
  it('renders with percent sign', () => {
    render(<ConfidenceCountUp value={88} />);
    // Before intersection fires the observer, value starts at 0 but the span
    // always renders with a "%" suffix.
    const span = screen.getByLabelText('88% confidence') as HTMLElement;
    expect(span.textContent).toMatch(/%/);
  });

  it('has correct aria-label with target value', () => {
    render(<ConfidenceCountUp value={92} />);
    const span = screen.getByLabelText('92% confidence');
    expect(span).toBeInTheDocument();
  });

  it('passes through className', () => {
    render(<ConfidenceCountUp value={75} className="text-green-600" />);
    const span = screen.getByLabelText('75% confidence');
    expect(span).toHaveClass('text-green-600');
  });

  it('renders final value immediately when IntersectionObserver is unavailable (SSR fallback)', () => {
    // Remove IntersectionObserver entirely to simulate SSR / old browsers
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    render(<ConfidenceCountUp value={65} />);
    const span = screen.getByLabelText('65% confidence');
    expect(span.textContent).toBe('65%');
  });
});
