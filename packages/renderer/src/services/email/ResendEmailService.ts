/**
 * ResendEmailService — Client-side facade for the sendEmail Cloud Function
 *
 * Provides a clean interface for sending transactional emails from any
 * module in the app (Legal, Distribution, Marketing, etc.)
 *
 * All actual sending happens server-side via Cloud Functions + Resend.
 * This service just marshals data and calls the function.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
    /** Recipient email address(es) */
    to: string | string[];
    /** Email subject line */
    subject: string;
    /** HTML body (used when template is 'custom' or not specified) */
    html?: string;
    /** Plain text body fallback */
    text?: string;
    /** Base64-encoded PDF attachment */
    attachmentBase64?: string;
    /** Filename for the attachment */
    attachmentFilename?: string;
    /** Reply-to address */
    replyTo?: string;
    /** Use a branded template */
    template?: 'contract' | 'notification' | 'invitation' | 'dmca' | 'custom';
    /** Template-specific variables */
    templateData?: Record<string, string>;
}

export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ResendEmailServiceImpl {
    /**
     * Send a transactional email via the Cloud Function.
     */
    async send(options: SendEmailOptions): Promise<SendEmailResult> {
        try {
            const functions = getFunctions(undefined, 'us-central1');
            const sendEmailFn = httpsCallable<SendEmailOptions, SendEmailResult>(
                functions,
                'sendEmail'
            );

            logger.info('[ResendEmailService] Sending email', {
                to: options.to,
                subject: options.subject,
                template: options.template || 'custom',
                hasAttachment: !!options.attachmentBase64,
            });

            const result = await sendEmailFn(options);

            if (result.data.success) {
                logger.info('[ResendEmailService] Email sent successfully', {
                    messageId: result.data.messageId,
                });
            } else {
                logger.warn('[ResendEmailService] Email send returned failure', {
                    error: result.data.error,
                });
            }

            return result.data;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[ResendEmailService] Send failed', { error: errorMessage });

            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Send a contract PDF via email.
     * Convenience wrapper for the Legal module.
     */
    async sendContract(params: {
        to: string;
        contractType: string;
        parties: string;
        pdfBase64: string;
        filename: string;
        message?: string;
    }): Promise<SendEmailResult> {
        return this.send({
            to: params.to,
            subject: `[indiiOS] ${params.contractType} — Ready for Review`,
            template: 'contract',
            templateData: {
                title: params.contractType,
                contractType: params.contractType,
                parties: params.parties,
                date: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                }),
                filename: params.filename,
                message: params.message || 'A contract has been prepared for your review. Please find the document attached to this email.',
            },
            attachmentBase64: params.pdfBase64,
            attachmentFilename: params.filename,
        });
    }

    /**
     * Send a notification email.
     * For general platform notifications.
     */
    async sendNotification(params: {
        to: string | string[];
        title: string;
        message: string;
    }): Promise<SendEmailResult> {
        return this.send({
            to: params.to,
            subject: `[indiiOS] ${params.title}`,
            template: 'notification',
            templateData: {
                title: params.title,
                message: params.message,
            },
        });
    }

    /**
     * Send a team invitation email.
     */
    async sendInvitation(params: {
        to: string;
        inviterName: string;
        inviteLink: string;
    }): Promise<SendEmailResult> {
        return this.send({
            to: params.to,
            subject: `[indiiOS] ${params.inviterName} invited you to collaborate`,
            template: 'invitation',
            templateData: {
                inviterName: params.inviterName,
                inviteLink: params.inviteLink,
            },
        });
    }
}

export const ResendEmailService = new ResendEmailServiceImpl();
