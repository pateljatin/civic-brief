import type { Feed } from '@/lib/types';

/**
 * Send an email alert when a feed has consecutive failures.
 * Graceful no-op if RESEND_API_KEY is not configured.
 */
export async function sendFeedFailureAlert(
  feed: Feed,
  consecutiveFailures: number,
  error: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!apiKey || !adminEmail) {
    console.warn('[email] RESEND_API_KEY or ADMIN_EMAIL not configured, skipping alert');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const { error: sendError } = await resend.emails.send({
    from: 'Civic Brief <alerts@civic-brief.vercel.app>',
    to: adminEmail,
    subject: `Feed Alert: ${feed.name} - ${consecutiveFailures} consecutive failures`,
    html: `
      <h2>Feed Failure Alert</h2>
      <p><strong>Feed:</strong> ${feed.name}</p>
      <p><strong>URL:</strong> ${feed.feed_url}</p>
      <p><strong>Consecutive failures:</strong> ${consecutiveFailures}</p>
      <p><strong>Latest error:</strong> ${error}</p>
      <p><strong>Feed ID:</strong> ${feed.id}</p>
      ${consecutiveFailures >= 5 ? '<p><strong>Feed has been auto-disabled.</strong></p>' : ''}
    `.trim(),
  });

  if (sendError) {
    console.error('[email] Failed to send feed failure alert:', sendError);
  }
}
