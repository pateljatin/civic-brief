import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ScrollFadeIn from '@/components/ScrollFadeIn';

// IntersectionObserver mock
type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let capturedCallback: IOCallback | null = null;
let mockObserve: ReturnType<typeof vi.fn>;
let mockUnobserve: ReturnType<typeof vi.fn>;
let mockDisconnect: ReturnType<typeof vi.fn>;

beforeEach(() => {
  capturedCallback = null;
  mockObserve = vi.fn();
  mockUnobserve = vi.fn();
  mockDisconnect = vi.fn();

  // Must use class syntax — arrow functions cannot be constructors (Vitest requirement)
  const observe = mockObserve;
  const unobserve = mockUnobserve;
  const disconnect = mockDisconnect;

  class MockIntersectionObserver {
    constructor(callback: IOCallback) {
      capturedCallback = callback;
    }
    observe = observe;
    unobserve = unobserve;
    disconnect = disconnect;
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fireIntersection(target: Element, isIntersecting: boolean) {
  act(() => {
    capturedCallback?.([
      { isIntersecting, target } as unknown as IntersectionObserverEntry,
    ]);
  });
}

describe('ScrollFadeIn', () => {
  it('renders children', () => {
    render(
      <ScrollFadeIn>
        <p>Hello world</p>
      </ScrollFadeIn>
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('starts without visible class', () => {
    const { container } = render(
      <ScrollFadeIn>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.classList.contains('scroll-fade-in')).toBe(true);
    expect(wrapper.classList.contains('visible')).toBe(false);
  });

  it('adds visible class when intersection fires', () => {
    const { container } = render(
      <ScrollFadeIn>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    fireIntersection(wrapper, true);
    expect(wrapper.classList.contains('visible')).toBe(true);
  });

  it('unobserves after first intersection (fires once)', () => {
    const { container } = render(
      <ScrollFadeIn>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    fireIntersection(wrapper, true);
    expect(mockUnobserve).toHaveBeenCalledWith(wrapper);
    expect(mockUnobserve).toHaveBeenCalledTimes(1);
  });

  it('applies custom delay as transition-delay inline style', () => {
    const { container } = render(
      <ScrollFadeIn delay={200}>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.transitionDelay).toBe('200ms');
  });

  it('passes through className', () => {
    const { container } = render(
      <ScrollFadeIn className="my-custom-class">
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.classList.contains('my-custom-class')).toBe(true);
    expect(wrapper.classList.contains('scroll-fade-in')).toBe(true);
  });
});
