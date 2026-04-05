/**
 * Email Service — Public API
 *
 * Re-exports for clean imports:
 *   import { EmailService } from '@/services/email';
 *   import type { EmailMessage } from '@/services/email';
 */

export { EmailService } from './EmailService';
export { GmailProvider } from './GmailProvider';
export { OutlookProvider } from './OutlookProvider';
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
} from './types';
