import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mocks ──

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });
const mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});

vi.mock('@/lib/supabase', () => ({
  getBrowserClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: vi.fn().mockResolvedValue({}),
    },
  })),
}));

import AuthButton from '@/components/AuthButton';

// ── Tests ──

describe('AuthButton', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'test-client-id-123');
    // Reset location mock
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://civic-brief.vercel.app', href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders Sign in button when not authenticated', async () => {
    render(<AuthButton />);
    // Wait for async getUser to resolve
    const btn = await screen.findByText('Sign in');
    expect(btn).toBeInTheDocument();
  });

  it('redirects to Google OAuth with correct params on click', async () => {
    render(<AuthButton />);
    const btn = await screen.findByText('Sign in');
    fireEvent.click(btn);

    const href = window.location.href;
    expect(href).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(href).toContain('client_id=test-client-id-123');
    expect(href).toContain('redirect_uri=');
    expect(href).toContain('response_type=code');
    expect(href).toContain('scope=openid+email+profile');
    expect(href).toContain('access_type=offline');
    expect(href).toContain('prompt=consent');
    expect(href).toContain('state=');
  });

  it('sets an oauth_state cookie before redirect', async () => {
    render(<AuthButton />);
    const btn = await screen.findByText('Sign in');
    fireEvent.click(btn);

    expect(document.cookie).toContain('oauth_state=');
    // Cookie should have Secure and SameSite attributes
    // (document.cookie getter doesn't show attributes, but the setter was called)
  });

  it('includes a state param that matches the cookie value', async () => {
    render(<AuthButton />);
    const btn = await screen.findByText('Sign in');
    fireEvent.click(btn);

    // Extract state from the redirect URL
    const url = new URL(window.location.href);
    const stateInUrl = url.searchParams.get('state');

    // Extract state from cookie
    const cookieParts = document.cookie.split(';').map((c) => c.trim());
    const stateCookie = cookieParts
      .find((c) => c.startsWith('oauth_state='))
      ?.split('=')[1];

    expect(stateInUrl).toBeTruthy();
    expect(stateInUrl).toBe(stateCookie);
  });

  it('does nothing if NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '');
    render(<AuthButton />);
    const btn = await screen.findByText('Sign in');
    fireEvent.click(btn);
    // href should not have been changed
    expect(window.location.href).toBe('');
  });

  it('does not use Supabase signInWithOAuth (removed)', async () => {
    render(<AuthButton />);
    const btn = await screen.findByText('Sign in');
    fireEvent.click(btn);

    // The redirect goes straight to Google, not through Supabase
    expect(window.location.href).toContain('accounts.google.com');
    expect(window.location.href).not.toContain('supabase');
  });
});
