import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfidenceScore from '@/components/ConfidenceScore';
import SourceLink from '@/components/SourceLink';
import LanguageToggle from '@/components/LanguageToggle';

describe('ConfidenceScore', () => {
  it('renders high confidence correctly', () => {
    render(<ConfidenceScore score={0.92} level="high" />);
    expect(screen.getByText(/92%/)).toBeInTheDocument();
    expect(screen.getByText(/High confidence/)).toBeInTheDocument();
  });

  it('decorative dot has aria-hidden', () => {
    const { container } = render(<ConfidenceScore score={0.92} level="high" />);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it('score text is accessible without relying on the decorative dot', () => {
    render(<ConfidenceScore score={0.75} level="medium" />);
    // Both percentage and label must be in the accessible tree
    expect(screen.getByText(/75%/)).toBeInTheDocument();
    expect(screen.getByText(/Medium confidence/)).toBeInTheDocument();
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

  it('link has descriptive aria-label with title', () => {
    render(
      <SourceLink
        url="https://seattle.gov/budget.pdf"
        title="City Budget FY2026"
      />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label', 'Verify: City Budget FY2026');
  });

  it('link has descriptive aria-label with domain when no title', () => {
    render(<SourceLink url="https://seattle.gov/budget.pdf" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label', expect.stringContaining('seattle.gov'));
  });
});

describe('LanguageToggle', () => {
  const available = ['en', 'es', 'hi'];

  it('renders a group with accessible label', () => {
    render(
      <LanguageToggle current="en" available={available} onChange={() => {}} />
    );
    expect(screen.getByRole('group', { name: 'Select language' })).toBeInTheDocument();
  });

  it('marks the active language button as pressed', () => {
    render(
      <LanguageToggle current="es" available={available} onChange={() => {}} />
    );
    const espanol = screen.getByText('Espanol');
    expect(espanol).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks inactive language buttons as not pressed', () => {
    render(
      <LanguageToggle current="en" available={available} onChange={() => {}} />
    );
    const espanol = screen.getByText('Espanol');
    expect(espanol).toHaveAttribute('aria-pressed', 'false');
  });

  it('ArrowRight moves focus to next button', () => {
    render(
      <LanguageToggle current="en" available={available} onChange={() => {}} />
    );
    const buttons = screen.getAllByRole('button');
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('ArrowLeft moves focus to previous button', () => {
    render(
      <LanguageToggle current="en" available={available} onChange={() => {}} />
    );
    const buttons = screen.getAllByRole('button');
    buttons[1].focus();
    fireEvent.keyDown(buttons[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('ArrowRight wraps from last to first button', () => {
    render(
      <LanguageToggle current="en" available={available} onChange={() => {}} />
    );
    const buttons = screen.getAllByRole('button');
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('ArrowLeft wraps from first to last button', () => {
    render(
      <LanguageToggle current="en" available={available} onChange={() => {}} />
    );
    const buttons = screen.getAllByRole('button');
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('only renders available languages', () => {
    render(
      <LanguageToggle current="en" available={['en', 'es']} onChange={() => {}} />
    );
    expect(screen.queryByText('Hindi')).not.toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Espanol')).toBeInTheDocument();
  });
});
