import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QualityBadges from '@/components/QualityBadges';

describe('QualityBadges', () => {
  it('renders reading level badge with grade', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 7.2, readabilityEase: 65 }} />);
    expect(screen.getByText(/Grade 7/)).toBeDefined();
  });

  it('renders tone badge when tone score is available', () => {
    render(
      <QualityBadges
        evalDetails={{
          readabilityGrade: 7.2,
          readabilityEase: 65,
          toneScore: 4,
          jargonScore: 5,
        }}
      />
    );
    expect(screen.getByText(/4\/5/)).toBeDefined();
  });

  it('renders only readability badge when tone is not yet available', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 7.2, readabilityEase: 65 }} />);
    expect(screen.getByText(/Grade 7/)).toBeDefined();
    expect(screen.queryByText(/Plain Language/)).toBeNull();
  });

  it('renders nothing when evalDetails is null', () => {
    const { container } = render(<QualityBadges evalDetails={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when readabilityGrade is missing or non-numeric', () => {
    const { container } = render(
      <QualityBadges evalDetails={{ readabilityGrade: NaN, readabilityEase: 0 }} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('applies green color for grade <= 8', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 7.0, readabilityEase: 70 }} />);
    const badge = screen.getByText(/Grade 7/).closest('div');
    expect(badge?.style.background).toContain('e9f5ec');
  });

  it('applies yellow color for grade 9-10', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 9.5, readabilityEase: 55 }} />);
    const badge = screen.getByText(/Grade 10/).closest('div');
    expect(badge?.style.background).toContain('rgb(254, 243, 226)');
  });

  it('applies red color for grade > 10', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 12.0, readabilityEase: 30 }} />);
    const badge = screen.getByText(/Grade 12/).closest('div');
    expect(badge?.style.background).toContain('rgb(254, 226, 226)');
  });
});
