/**
 * Unified Email Types for indiiOS
 *
 * Provider-agnostic types for Gmail and Outlook integration.
 * All provider-specific data is normalized to these shapes.
 */

// ---------------------------------------------------------------------------
// Core Email Types
// ---------------------------------------------------------------------------

export type EmailProvider = 'gmail' | 'outlook';

export interface EmailAccount {
    id: string;
    provider: EmailProvider;
    email: string;
    displayName: string;
    avatarUrl?: string;
    isConnected: boolean;
    lastSyncAt: number | null;
    /** Provider-specific access token (stored in Firestore, encrypted at rest) */
    tokenDocPath?: string;
}

export interface EmailMessage {
    id: string;
    threadId: string;
    provider: EmailProvider;
    accountId: string;
    from: EmailAddress;
    to: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
    subject: string;
    snippet: string;
    bodyText?: string;
    bodyHtml?: string;
    date: number; // Unix timestamp ms
    isRead: boolean;
    isStarred: boolean;
    isDraft: boolean;
    labels: string[];
    attachments: EmailAttachment[];
    /** Raw provider message ID for API operations */
    providerMessageId: string;
}

export interface EmailAddress {
    name: string;
    email: string;
}

export interface EmailAttachment {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    /** Download URL (generated on demand) */
    url?: string;
}

export interface EmailThread {
    id: string;
    provider: EmailProvider;
    accountId: string;
    subject: string;
    snippet: string;
    messages: EmailMessage[];
    participants: EmailAddress[];
    lastMessageDate: number;
    isRead: boolean;
    messageCount: number;
    labels: string[];
}

// ---------------------------------------------------------------------------
// Compose / Send Types
// ---------------------------------------------------------------------------

export interface ComposeEmailData {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
    attachments?: File[];
    /** For replies */
    inReplyTo?: string;
    threadId?: string;
    accountId: string;
}

export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ---------------------------------------------------------------------------
// Sync / Fetch Types
// ---------------------------------------------------------------------------

export interface EmailSyncOptions {
    maxResults?: number;
    pageToken?: string;
    query?: string;
    labelFilter?: string;
    after?: number; // Unix timestamp for incremental sync
}

export interface EmailSyncResult {
    messages: EmailMessage[];
    nextPageToken?: string;
    totalEstimate?: number;
    syncedAt: number;
}

// ---------------------------------------------------------------------------
// OAuth Types
// ---------------------------------------------------------------------------

export interface OAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix timestamp ms
    scope: string;
    provider: EmailProvider;
}

export interface OAuthConfig {
    clientId: string;
    scopes: string[];
    redirectUri: string;
}

// ---------------------------------------------------------------------------
// Provider Interface
// ---------------------------------------------------------------------------

export interface EmailProviderInterface {
    readonly provider: EmailProvider;

    /** Initiate OAuth flow and return the auth URL */
    getAuthUrl(): string;

    /** Exchange auth code for tokens */
    exchangeCode(code: string): Promise<OAuthTokens>;

    /** Refresh an expired access token */
    refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

    /** Fetch messages from the provider */
    fetchMessages(accessToken: string, options?: EmailSyncOptions): Promise<EmailSyncResult>;

    /** Send an email */
    sendEmail(accessToken: string, data: ComposeEmailData): Promise<SendEmailResult>;

    /** Mark a message as read */
    markAsRead(accessToken: string, messageId: string): Promise<void>;

    /** Star/unstar a message */
    toggleStar(accessToken: string, messageId: string, starred: boolean): Promise<void>;

    /** Trash a message */
    trashMessage(accessToken: string, messageId: string): Promise<void>;

    /** Get a single message with full body */
    getMessage(accessToken: string, messageId: string): Promise<EmailMessage>;
}
