import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScenarioCard from '@/components/ScenarioCard';
import type { ScenarioConfig } from '@/lib/showcase';

// IntersectionObserver mock (class syntax required — arrow functions cannot be constructors)
class MockIntersectionObserver {
  constructor(_callback: IntersectionObserverCallback) {}
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
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mockScenario: ScenarioConfig = {
  slug: 'budget',
  title: 'Budget Season',
  icon: '💰',
  color: '#1a2332',
  jurisdiction: 'King County / Seattle, WA',
  narrative:
    "The city just released a 400-page budget. Your library hours, your bus route, your park maintenance — it's all in there, if you can find it.",
  story: 'The full story text.',
  documentTitle: 'Seattle 2025-2026 Proposed Budget',
  briefId: 'brief-123',
  sourceUrl: 'https://www.seattle.gov/city-budget',
};

const mockScenarioComingSoon: ScenarioConfig = {
  ...mockScenario,
  slug: 'school-board',
  title: 'School Board',
  briefId: null,
};

describe('ScenarioCard', () => {
  it('renders title', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={88} index={0} />);
    expect(screen.getByRole('heading', { name: 'Budget Season' })).toBeInTheDocument();
  });

  it('renders narrative text', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={88} index={0} />);
    expect(screen.getByText(mockScenario.narrative)).toBeInTheDocument();
  });

  it('renders jurisdiction badge', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={88} index={0} />);
    expect(screen.getByText('King County / Seattle, WA')).toBeInTheDocument();
  });

  it('renders confidence value as percentage', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={88} index={0} />);
    // ConfidenceCountUp renders aria-label "{value}% confidence"
    const el = screen.getByLabelText('88% confidence');
    expect(el).toBeInTheDocument();
  });

  it('links to correct detail page', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={88} index={0} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/showcase/budget');
  });

  it('has correct aria-label', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={88} index={0} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label', 'Read about Budget Season - King County / Seattle, WA');
  });

  it('renders error state when confidence is null', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={null} index={0} />);
    expect(screen.getByText('Brief unavailable')).toBeInTheDocument();
    expect(screen.queryByLabelText(/confidence/)).not.toBeInTheDocument();
    expect(screen.queryByText(mockScenario.narrative)).not.toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={88} index={0} />);
    expect(screen.getByText('💰')).toBeInTheDocument();
  });

  it('renders coming soon state when briefId is null', () => {
    render(<ScenarioCard scenario={mockScenarioComingSoon} confidence={null} index={0} />);
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
