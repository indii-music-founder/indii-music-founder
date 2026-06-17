import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { EmailService } from '@/services/email';
import type { EmailProvider } from '@/services/email/types';

export const EmailTools = {
    list_email_accounts: wrapTool('list_email_accounts', async () => {
        try {
            const accounts = await EmailService.getConnectedAccounts();
            return toolSuccess({ accounts }, `Found ${accounts.length} connected email accounts.`);
        } catch (error: any) {
            return toolError(`Failed to list email accounts: ${error.message}`);
        }
    }),

    read_emails: wrapTool('read_emails', async (args: { provider: EmailProvider; forceSync?: boolean; maxResults?: number }) => {
        try {
            if (args.forceSync) {
                await EmailService.fetchMessages(args.provider, { maxResults: args.maxResults || 20 });
            }
            const messages = EmailService.getCachedMessages(args.provider);
            // Return only the top maxResults to avoid massive payload
            const limit = args.maxResults || 20;
            const recent = messages.slice(0, limit);
            
            return toolSuccess({ messages: recent }, `Retrieved ${recent.length} recent messages for ${args.provider}.`);
        } catch (error: any) {
            return toolError(`Failed to read emails: ${error.message}`);
        }
    }),

    send_email: wrapTool('send_email', async (args: { accountId: string; to: string; subject: string; body: string }) => {
        try {
            const result = await EmailService.sendEmail({
                accountId: args.accountId,
                to: [args.to],
                subject: args.subject,
                body: args.body,
                isHtml: false
            });
            return toolSuccess(result, `Email sent successfully to ${args.to} via account ${args.accountId}.`);
        } catch (error: any) {
            return toolError(`Failed to send email: ${error.message}`);
        }
    }),

    reply_to_email: wrapTool('reply_to_email', async (args: { accountId: string; to: string; subject: string; body: string; threadId: string; inReplyTo: string }) => {
        try {
            const result = await EmailService.sendEmail({
                accountId: args.accountId,
                to: [args.to],
                subject: args.subject.startsWith('Re:') ? args.subject : `Re: ${args.subject}`,
                body: args.body,
                isHtml: false,
                threadId: args.threadId,
                inReplyTo: args.inReplyTo
            });
            return toolSuccess(result, `Reply sent successfully to ${args.to} on thread ${args.threadId}.`);
        } catch (error: any) {
            return toolError(`Failed to reply to email: ${error.message}`);
        }
    })
} satisfies Record<string, AnyToolFunction>;

export const {
    list_email_accounts,
    read_emails,
    send_email,
    reply_to_email
} = EmailTools;
