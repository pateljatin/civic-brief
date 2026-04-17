import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ConfidenceScore from '@/components/ConfidenceScore';
import SourceLink from '@/components/SourceLink';
import LanguageToggle from '@/components/LanguageToggle';
import CivicBrief from '@/components/CivicBrief';
import type { CivicContent } from '@/lib/types';

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

// Shared minimal CivicBrief props for unit tests
const MINIMAL_CONTENT: CivicContent = {
  title: 'Test',
  what_changed: 'Something changed.',
  who_affected: 'Residents.',
  what_to_do: 'Attend the meeting.',
  money: null,
  deadlines: [],
  context: '',
  key_quotes: [],
  document_type: 'resolution',
};

const MINIMAL_BRIEF_PROPS = {
  headline: 'Test Headline',
  content: MINIMAL_CONTENT,
  sourceUrl: 'https://example.gov/doc.pdf',
  confidenceScore: 0.88,
  confidenceLevel: 'high' as const,
  currentLanguage: 'en',
  availableLanguages: ['en'],
};

describe('CivicBrief — copy link button', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://civic-brief.vercel.app/brief/abc-123' },
      configurable: true,
      writable: true,
    });
  });

  it('renders the copy link button', () => {
    render(<CivicBrief {...MINIMAL_BRIEF_PROPS} />);
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
  });

  it('shows "Copied!" feedback after clicking', async () => {
    render(<CivicBrief {...MINIMAL_BRIEF_PROPS} />);
    const btn = screen.getByRole('button', { name: /copy link/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
    });
  });

  it('calls clipboard.writeText with the current URL', async () => {
    render(<CivicBrief {...MINIMAL_BRIEF_PROPS} />);
    const btn = screen.getByRole('button', { name: /copy link/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://civic-brief.vercel.app/brief/abc-123'
      );
    });
  });

  it('reverts to "Copy link" after 2 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<CivicBrief {...MINIMAL_BRIEF_PROPS} />);
    const btn = screen.getByRole('button', { name: /copy link/i });
    fireEvent.click(btn);
    // Wait for the clipboard promise to resolve and state to update
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/Copy link/i)).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('CivicBrief — last updated timestamp', () => {
  it('shows formatted date when generatedAt is provided', () => {
    render(
      <CivicBrief
        {...MINIMAL_BRIEF_PROPS}
        generatedAt="2026-04-14T10:30:00Z"
      />
    );
    expect(screen.getByText(/Summarized/)).toBeInTheDocument();
    expect(screen.getByText(/April 14, 2026/)).toBeInTheDocument();
  });

  it('hides the timestamp when generatedAt is not provided', () => {
    render(<CivicBrief {...MINIMAL_BRIEF_PROPS} />);
    expect(screen.queryByText(/Summarized/)).not.toBeInTheDocument();
  });

  it('hides the timestamp when generatedAt is undefined', () => {
    render(<CivicBrief {...MINIMAL_BRIEF_PROPS} generatedAt={undefined} />);
    expect(screen.queryByText(/Summarized/)).not.toBeInTheDocument();
  });
});
