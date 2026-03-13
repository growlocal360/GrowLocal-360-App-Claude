import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return new Resend(apiKey);
}

interface SendInviteEmailParams {
  to: string;
  inviterName: string;
  orgName: string;
  role: string;
  inviteUrl: string;
}

export async function sendInviteEmail({
  to,
  inviterName,
  orgName,
  role,
  inviteUrl,
}: SendInviteEmailParams) {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `${inviterName} invited you to join ${orgName} on GrowLocal 360`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111827; margin-bottom: 8px;">You've been invited!</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as ${role === 'admin' ? 'an' : 'a'} <strong>${role}</strong> on GrowLocal 360.
        </p>
        <div style="margin: 32px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background-color: #00d9c0; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 14px;">
          This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          GrowLocal 360 &mdash; AI-Powered Local Business Websites
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send invite email:', error);
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }
}
