import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockFeed } from '../../helpers/factories';

// Hoist mockEmailSend so the factory function below can close over it
const mockEmailSend = vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null });

vi.mock('resend', () => {
  return {
    Resend: function MockResend(_key: string) {
      return { emails: { send: mockEmailSend } };
    },
  };
});

describe('alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockEmailSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_EMAIL;
  });

  describe('sendFeedFailureAlert', () => {
    it('sends email when RESEND_API_KEY and ADMIN_EMAIL are configured', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.ADMIN_EMAIL = 'admin@test.com';
      const { sendFeedFailureAlert } = await import('@/lib/email/alerts');
      const feed = createMockFeed({ name: 'Test Feed', consecutive_failures: 3 });
      await expect(sendFeedFailureAlert(feed, 3, 'timeout')).resolves.not.toThrow();
      expect(mockEmailSend).toHaveBeenCalledOnce();
    });

    it('no-ops gracefully when RESEND_API_KEY is missing', async () => {
      process.env.ADMIN_EMAIL = 'admin@test.com';
      const { sendFeedFailureAlert } = await import('@/lib/email/alerts');
      const feed = createMockFeed();
      await expect(sendFeedFailureAlert(feed, 3, 'timeout')).resolves.not.toThrow();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it('no-ops gracefully when ADMIN_EMAIL is missing', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      const { sendFeedFailureAlert } = await import('@/lib/email/alerts');
      const feed = createMockFeed();
      await expect(sendFeedFailureAlert(feed, 3, 'timeout')).resolves.not.toThrow();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it('includes auto-disabled notice when failures >= 5', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.ADMIN_EMAIL = 'admin@test.com';
      const { sendFeedFailureAlert } = await import('@/lib/email/alerts');
      const feed = createMockFeed({ name: 'Failing Feed' });
      await sendFeedFailureAlert(feed, 5, 'connection refused');

      expect(mockEmailSend).toHaveBeenCalledOnce();
      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('auto-disabled');
      expect(callArgs.subject).toContain('5 consecutive failures');
    });

    it('does not include auto-disabled notice when failures < 5', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.ADMIN_EMAIL = 'admin@test.com';
      const { sendFeedFailureAlert } = await import('@/lib/email/alerts');
      const feed = createMockFeed({ name: 'Failing Feed' });
      await sendFeedFailureAlert(feed, 3, 'timeout');

      expect(mockEmailSend).toHaveBeenCalledOnce();
      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).not.toContain('auto-disabled');
    });
  });
});
