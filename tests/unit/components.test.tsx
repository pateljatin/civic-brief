import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfidenceScore from '@/components/ConfidenceScore';
import SourceLink from '@/components/SourceLink';

describe('ConfidenceScore', () => {
  it('renders high confidence correctly', () => {
    render(<ConfidenceScore score={0.92} level="high" />);
    expect(screen.getByText(/92%/)).toBeInTheDocument();
    expect(screen.getByText(/High confidence/)).toBeInTheDocument();
  });

  it('renders medium confidence correctly', () => {
    render(<ConfidenceScore score={0.65} level="medium" />);
    expect(screen.getByText(/65%/)).toBeInTheDocument();
    expect(screen.getByText(/Medium confidence/)).toBeInTheDocument();
  });

  it('renders low confidence correctly', () => {
    render(<ConfidenceScore score={0.3} level="low" />);
    expect(screen.getByText(/30%/)).toBeInTheDocument();
    expect(screen.getByText(/Low confidence/)).toBeInTheDocument();
  });

  it('rounds score to integer percentage', () => {
    render(<ConfidenceScore score={0.876} level="high" />);
    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });
});

describe('SourceLink', () => {
  it('renders link with correct URL', () => {
    render(<SourceLink url="https://seattle.gov/budget.pdf" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://seattle.gov/budget.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('extracts domain from URL', () => {
    render(<SourceLink url="https://www.seattle.gov/documents/budget.pdf" />);
    expect(screen.getByText(/seattle.gov/)).toBeInTheDocument();
  });

  it('uses custom title when provided', () => {
    render(
      <SourceLink
        url="https://seattle.gov/budget.pdf"
        title="City Budget FY2026"
      />
    );
    expect(screen.getByText(/Verify: City Budget FY2026/)).toBeInTheDocument();
  });
});
