/**
 * Shared transactional email helper for internal server-side callers
 * (Inngest step functions, background workers). Distinct from the
 * client-facing `sendEmail` callable in `email/sendEmail.ts` — that one
 * is invoked directly by the client SDK and expects a `CallableRequest`;
 * this one is a plain async function usable from within a `step.run()`.
 */
import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';

export const resendApiKey = defineSecret('RESEND_API_KEY');

function getResendApiKey(): string {
    const envKey = process.env.RESEND_API_KEY;
    if (envKey) return envKey;
    try {
        return resendApiKey.value();
    } catch {
        return '';
    }
}

export async function sendTransactionalEmail(
    to: string,
    subject: string,
    html: string,
): Promise<{ sent: boolean; reason?: string; messageId?: string }> {
    const apiKey = getResendApiKey();
    if (!apiKey) {
        console.warn('[Notify] RESEND_API_KEY not configured. Skipping email send.');
        return { sent: false, reason: 'RESEND_API_KEY not configured' };
    }
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'indii <hello@indii.music>',
        to,
        subject,
        html,
    });
    if (result.error) {
        console.error('[Notify] Resend send failed:', result.error);
        return { sent: false, reason: result.error.message };
    }
    return { sent: true, messageId: result.data?.id };
}
