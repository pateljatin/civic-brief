import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScenarioHero from '@/components/ScenarioHero';
import type { ScenarioConfig } from '@/lib/showcase';

const mockScenario: ScenarioConfig = {
  slug: 'budget',
  title: 'Budget Season',
  icon: '💰',
  color: '#1a2332',
  jurisdiction: 'King County / Seattle, WA',
  narrative: 'The city just released a 400-page budget.',
  story: 'Every fall, Seattle and King County publish proposed budgets that determine what gets funded and what gets cut.',
  documentTitle: 'Seattle 2025-2026 Proposed Budget',
  briefId: null,
  sourceUrl: 'https://www.seattle.gov/city-budget',
};

describe('ScenarioHero', () => {
  it('renders title as h1', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.88} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Budget Season');
  });

  it('renders story paragraph', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.88} />);
    expect(
      screen.getByText(/Every fall, Seattle and King County publish proposed budgets/)
    ).toBeInTheDocument();
  });

  it('renders jurisdiction', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.88} />);
    expect(screen.getByText('King County / Seattle, WA')).toBeInTheDocument();
  });

  it('renders document title', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.88} />);
    expect(screen.getByText('Seattle 2025-2026 Proposed Budget')).toBeInTheDocument();
  });

  it('renders source link with correct href', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.88} />);
    const link = screen.getByRole('link', { name: /View original document/ });
    expect(link).toHaveAttribute('href', 'https://www.seattle.gov/city-budget');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders confidence score', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.88} />);
    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.88} />);
    expect(screen.getByText('💰')).toBeInTheDocument();
  });

  it('renders error state when confidence is 0', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0} />);
    expect(
      screen.getByText('This brief is currently unavailable. Please try again later.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('King County / Seattle, WA')).not.toBeInTheDocument();
  });
});
