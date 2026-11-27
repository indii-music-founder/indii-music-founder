/**
 * Email Service — Public API
 *
 * Re-exports for clean imports:
 *   import { EmailService } from '@/services/email';
 *   import type { EmailMessage } from '@/services/email';
 */

export { EmailService } from '@/services/email/EmailService';
export { GmailProvider } from '@/services/email/GmailProvider';
export { OutlookProvider } from '@/services/email/OutlookProvider';
export type {
    EmailProvider,
    EmailAccount,
    EmailMessage,
    EmailThread,
    EmailAttachment,
    EmailAddress,
    EmailSyncOptions,
    EmailSyncResult,
    ComposeEmailData,
    SendEmailResult,
    EmailProviderInterface,
    OAuthTokens,
    OAuthExchangeResult,
} from '@/services/email/types';
