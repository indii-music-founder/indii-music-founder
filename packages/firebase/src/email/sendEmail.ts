/**
 * Email Service — Resend Integration for indiiOS
 *
 * Production-grade transactional email service for:
 *   - Contract delivery (NDA, IP Assignment, Performance Agreements)
 *   - Distribution confirmations
 *   - DMCA notices
 *   - Team invitations
 *   - General notifications
 *
 * Architecture:
 *   - Resend SDK handles delivery via Amazon SES backbone
 *   - defineSecret() for production key management
 *   - Firestore audit log for every email sent
 *   - Branded HTML templates with indiiOS identity
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { Resend } from 'resend';
import * as admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Secret Management
// ---------------------------------------------------------------------------

const resendApiKey = defineSecret('RESEND_API_KEY');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendEmailRequest {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    /** Base64-encoded PDF attachment */
    attachmentBase64?: string;
    attachmentFilename?: string;
    /** Optional reply-to address */
    replyTo?: string;
    /** Template type for branded emails */
    template?: 'contract' | 'notification' | 'invitation' | 'dmca' | 'custom';
    /** Template variables */
    templateData?: Record<string, string>;
}

interface SendEmailResponse {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ---------------------------------------------------------------------------
// HTML Email Templates
// ---------------------------------------------------------------------------

function getEmailTemplate(
    template: string,
    data: Record<string, string> = {}
): { html: string; text: string } {
    switch (template) {
        case 'contract':
            return {
                html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #111118 0%, #0d0d14 100%); border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%); padding: 32px 40px; border-bottom: 1px solid rgba(99, 102, 241, 0.1); }
        .logo { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .logo span { background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .badge { display: inline-block; background: rgba(99, 102, 241, 0.15); color: #a5b4fc; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 20px; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .body { padding: 40px; color: #e2e8f0; }
        .body h2 { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 16px 0; }
        .body p { color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .detail-label { color: #64748b; font-size: 13px; font-weight: 500; }
        .detail-value { color: #e2e8f0; font-size: 13px; font-weight: 600; }
        .attachment-box { background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 20px; margin: 24px 0; }
        .attachment-box p { color: #a5b4fc; margin: 0; font-size: 14px; }
        .attachment-box .filename { color: #ffffff; font-weight: 600; }
        .cta { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 8px 0; }
        .footer { padding: 24px 40px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; }
        .footer p { color: #475569; font-size: 12px; margin: 0; }
        .footer a { color: #6366f1; text-decoration: none; }
    </style>
</head>
<body>
    <div style="padding: 24px;">
        <div class="container">
            <div class="header">
                <div class="logo">indii<span>OS</span></div>
                <div class="badge">📄 Contract Delivery</div>
            </div>
            <div class="body">
                <h2>${data.title || 'Contract Document'}</h2>
                <p>${data.message || 'A contract has been prepared for your review. Please find the document attached to this email.'}</p>
                
                ${data.contractType ? `
                <div style="margin: 24px 0;">
                    <div class="detail-row">
                        <span class="detail-label">Contract Type</span>
                        <span class="detail-value">${data.contractType}</span>
                    </div>
                    ${data.parties ? `
                    <div class="detail-row">
                        <span class="detail-label">Parties</span>
                        <span class="detail-value">${data.parties}</span>
                    </div>
                    ` : ''}
                    ${data.date ? `
                    <div class="detail-row">
                        <span class="detail-label">Date</span>
                        <span class="detail-value">${data.date}</span>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
                
                <div class="attachment-box">
                    <p>📎 Attached: <span class="filename">${data.filename || 'contract.pdf'}</span></p>
                </div>
                
                <p style="color: #64748b; font-size: 13px;">
                    Please review the attached document carefully. If you have any questions or require amendments, 
                    reply directly to this email.
                </p>
            </div>
            <div class="footer">
                <p>Powered by <a href="https://indiios.com">indiiOS</a> — The Creative Operating System</p>
                <p style="margin-top: 8px;">© ${new Date().getFullYear()} IndiiOS LLC. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`,
                text: `${data.title || 'Contract Document'}\n\n${data.message || 'A contract has been prepared for your review.'}\n\nContract Type: ${data.contractType || 'N/A'}\nParties: ${data.parties || 'N/A'}\nDate: ${data.date || new Date().toLocaleDateString()}\n\nPlease find the document attached to this email.\n\n---\nPowered by indiiOS — The Creative Operating System`
            };

        case 'notification':
            return {
                html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background: #111118; border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 16px; overflow: hidden; }
        .header { background: rgba(99, 102, 241, 0.08); padding: 28px 40px; border-bottom: 1px solid rgba(99, 102, 241, 0.1); }
        .logo { font-size: 22px; font-weight: 800; color: #ffffff; }
        .logo span { color: #6366f1; }
        .body { padding: 36px 40px; color: #e2e8f0; }
        .body h2 { color: #ffffff; font-size: 18px; margin: 0 0 14px 0; }
        .body p { color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 14px 0; }
        .footer { padding: 20px 40px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; }
        .footer p { color: #475569; font-size: 12px; margin: 0; }
    </style>
</head>
<body>
    <div style="padding: 24px;">
        <div class="container">
            <div class="header">
                <div class="logo">indii<span>OS</span></div>
            </div>
            <div class="body">
                <h2>${data.title || 'Notification'}</h2>
                <p>${data.message || ''}</p>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} IndiiOS LLC</p>
            </div>
        </div>
    </div>
</body>
</html>`,
                text: `${data.title || 'Notification'}\n\n${data.message || ''}\n\n---\nindiiOS`
            };

        case 'invitation':
            return {
                html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background: #111118; border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(236, 72, 153, 0.1)); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 800; color: #ffffff; }
        .logo span { color: #6366f1; }
        .body { padding: 40px; color: #e2e8f0; text-align: center; }
        .body h2 { color: #ffffff; font-size: 22px; margin: 0 0 16px 0; }
        .body p { color: #94a3b8; font-size: 15px; line-height: 1.7; }
        .cta { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff !important; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 700; font-size: 16px; margin: 24px 0; }
        .footer { padding: 24px 40px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; }
        .footer p { color: #475569; font-size: 12px; margin: 0; }
    </style>
</head>
<body>
    <div style="padding: 24px;">
        <div class="container">
            <div class="header">
                <div class="logo">indii<span>OS</span></div>
            </div>
            <div class="body">
                <h2>You're Invited!</h2>
                <p>${data.inviterName || 'Someone'} has invited you to join their team on indiiOS.</p>
                <a href="${data.inviteLink || 'https://indiios.com'}" class="cta">Accept Invitation</a>
                <p style="font-size: 13px; color: #64748b;">This invitation expires in 7 days.</p>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} IndiiOS LLC</p>
            </div>
        </div>
    </div>
</body>
</html>`,
                text: `You're Invited!\n\n${data.inviterName || 'Someone'} has invited you to join their team on indiiOS.\n\nAccept: ${data.inviteLink || 'https://indiios.com'}\n\nThis invitation expires in 7 days.`
            };

        default:
            return {
                html: data.html || `<p>${data.message || ''}</p>`,
                text: data.text || data.message || ''
            };
    }
}

// ---------------------------------------------------------------------------
// Cloud Function: sendEmail
// ---------------------------------------------------------------------------

export const sendEmail = onCall(
    {
        secrets: [resendApiKey],
        region: 'us-central1',
        enforceAppCheck: false, // TODO: Enable for production
        maxInstances: 10,
    },
    async (request): Promise<SendEmailResponse> => {
        // Auth check
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated to send emails');
        }

        const data = request.data as SendEmailRequest;

        // Validate required fields
        if (!data.to) {
            throw new HttpsError('invalid-argument', 'Recipient (to) is required');
        }
        if (!data.subject) {
            throw new HttpsError('invalid-argument', 'Subject is required');
        }

        // Initialize Resend
        const resend = new Resend(resendApiKey.value());

        // Build email content
        let htmlContent = data.html || '';
        let textContent = data.text || '';

        if (data.template && data.template !== 'custom') {
            const templateResult = getEmailTemplate(data.template, data.templateData || {});
            htmlContent = templateResult.html;
            textContent = templateResult.text;
        }

        // Build attachments array
        const attachments: Array<{ filename: string; content: Buffer }> = [];
        if (data.attachmentBase64 && data.attachmentFilename) {
            attachments.push({
                filename: data.attachmentFilename,
                content: Buffer.from(data.attachmentBase64, 'base64'),
            });
        }

        try {
            // Send via Resend
            const result = await resend.emails.send({
                from: 'indiiOS <onboarding@resend.dev>',  // Use verified domain in production
                to: Array.isArray(data.to) ? data.to : [data.to],
                subject: data.subject,
                html: htmlContent,
                text: textContent,
                replyTo: data.replyTo || undefined,
                attachments: attachments.length > 0 ? attachments : undefined,
            });

            if (result.error) {
                console.error('[EmailService] Resend error:', result.error);

                // Audit log — failure
                await logEmailEvent(request.auth.uid, {
                    to: data.to,
                    subject: data.subject,
                    template: data.template || 'custom',
                    status: 'failed',
                    error: result.error.message,
                    timestamp: Date.now(),
                });

                return {
                    success: false,
                    error: result.error.message,
                };
            }

            console.log('[EmailService] Email sent successfully:', result.data?.id);

            // Audit log — success
            await logEmailEvent(request.auth.uid, {
                to: data.to,
                subject: data.subject,
                template: data.template || 'custom',
                status: 'sent',
                messageId: result.data?.id,
                hasAttachment: attachments.length > 0,
                attachmentFilename: data.attachmentFilename,
                timestamp: Date.now(),
            });

            return {
                success: true,
                messageId: result.data?.id,
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[EmailService] Send failed:', errorMessage);

            // Audit log — exception
            await logEmailEvent(request.auth.uid, {
                to: data.to,
                subject: data.subject,
                template: data.template || 'custom',
                status: 'error',
                error: errorMessage,
                timestamp: Date.now(),
            });

            throw new HttpsError('internal', `Email send failed: ${errorMessage}`);
        }
    }
);

// ---------------------------------------------------------------------------
// Firestore Audit Log
// ---------------------------------------------------------------------------

async function logEmailEvent(
    userId: string,
    event: Record<string, unknown>
): Promise<void> {
    try {
        const db = admin.firestore();
        await db.collection('users').doc(userId).collection('emailLog').add({
            ...event,
            sentBy: userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
        // Don't fail email delivery because of audit log issues
        console.warn('[EmailService] Audit log write failed:', err);
    }
}
