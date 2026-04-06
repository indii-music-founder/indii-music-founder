/**
 * Gmail Provider — Uses Google Identity Services (GIS) for OAuth
 * and the Gmail REST API for message operations.
 *
 * Architecture:
 *   1. OAuth: Uses GIS tokenClient for incremental scope auth
 *   2. Token Refresh: Via Cloud Function (refresh tokens are server-side only)
 *   3. API Calls: Direct REST to gmail.googleapis.com from the client
 *
 * Security:
 *   - Refresh tokens are stored in Firestore (server-side only)
 *   - Access tokens are short-lived (1 hour) and held in memory
 *   - Scopes are minimal: gmail.readonly + gmail.send
 */

import { logger } from '@/utils/logger';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import type {
    EmailProviderInterface,
    EmailMessage,
    EmailSyncOptions,
    EmailSyncResult,
    ComposeEmailData,
    SendEmailResult,
    OAuthTokens,
    EmailAddress,
    EmailAttachment,
} from './types';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
];

/**
 * Parse a Gmail API message resource into our unified EmailMessage type.
 */
function parseGmailMessage(raw: unknown, accountId: string): EmailMessage {
    const rawMsg = raw as Record<string, unknown>;
    const payloadInfo = rawMsg.payload as Record<string, unknown> | undefined;

    const headers = (payloadInfo?.headers as Array<Record<string, unknown>>) || [];
    const getHeader = (name: string): string =>
        (headers.find((h: Record<string, unknown>) => typeof h.name === 'string' && h.name.toLowerCase() === name.toLowerCase())?.value as string) || '';

    const fromRaw = getHeader('From');
    const toRaw = getHeader('To');
    const ccRaw = getHeader('Cc');
    const subject = getHeader('Subject');
    const dateRaw = getHeader('Date');

    // Parse email addresses from "Name <email>" format
    const parseAddress = (str: string): EmailAddress => {
        const match = str.match(/^(.+?)\s*<(.+?)>$/);
        if (match) {
            return { name: match[1]!.trim().replace(/^"|"$/g, ''), email: match[2]! };
        }
        return { name: str.trim(), email: str.trim() };
    };

    const parseAddressList = (str: string): EmailAddress[] =>
        str ? str.split(',').map(s => parseAddress(s.trim())).filter(a => a.email) : [];

    // Extract body text
    let bodyText = '';
    let bodyHtml = '';
    const extractBody = (payload: unknown) => {
        const p = payload as Record<string, unknown>;
        const bodyObj = p.body as Record<string, unknown> | undefined;

        if (p.mimeType === 'text/plain' && typeof bodyObj?.data === 'string') {
            bodyText = atob(bodyObj.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (p.mimeType === 'text/html' && typeof bodyObj?.data === 'string') {
            bodyHtml = atob(bodyObj.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (Array.isArray(p.parts)) {
            p.parts.forEach(extractBody);
        }
    };
    if (payloadInfo) extractBody(payloadInfo);

    // Extract attachments
    const attachments: EmailAttachment[] = [];
    const extractAttachments = (payload: unknown) => {
        const p = payload as Record<string, unknown>;
        const bodyObj = p.body as Record<string, unknown> | undefined;

        if (typeof p.filename === 'string' && p.filename && typeof bodyObj?.attachmentId === 'string') {
            attachments.push({
                id: bodyObj.attachmentId,
                filename: p.filename,
                mimeType: (p.mimeType as string) || 'application/octet-stream',
                size: (bodyObj.size as number) || 0,
            });
        }
        if (Array.isArray(p.parts)) {
            p.parts.forEach(extractAttachments);
        }
    };
    if (payloadInfo) extractAttachments(payloadInfo);

    const labelIds: string[] = (rawMsg.labelIds as string[]) || [];
    const isRead = !labelIds.includes('UNREAD');
    const isStarred = labelIds.includes('STARRED');
    const isDraft = labelIds.includes('DRAFT');

    return {
        id: `gmail_${rawMsg.id}`,
        threadId: (rawMsg.threadId as string) || (rawMsg.id as string),
        provider: 'gmail',
        accountId,
        from: parseAddress(fromRaw),
        to: parseAddressList(toRaw),
        cc: parseAddressList(ccRaw),
        subject,
        snippet: (rawMsg.snippet as string) || '',
        bodyText,
        bodyHtml,
        date: rawMsg.internalDate ? parseInt(rawMsg.internalDate as string) : new Date(dateRaw).getTime(),
        isRead,
        isStarred,
        isDraft,
        labels: labelIds,
        attachments,
        providerMessageId: rawMsg.id as string,
    };
}

export class GmailProvider implements EmailProviderInterface {
    readonly provider = 'gmail' as const;
    private clientId: string;

    constructor() {
        this.clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
    }

    getAuthUrl(): string {
        // GIS uses a popup flow, not a redirect URL
        // This returns the client-side auth initiation URL
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: `${window.location.origin}/auth/gmail/callback`,
            response_type: 'code',
            scope: GMAIL_SCOPES.join(' '),
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokens> {
        // Exchange happens server-side via Cloud Function for security
        const exchangeTokens = httpsCallable<
            { code: string; provider: string },
            OAuthTokens
        >(functions, 'emailExchangeToken');

        const result = await exchangeTokens({ code, provider: 'gmail' });
        return result.data;
    }

    async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
        const refreshFn = httpsCallable<
            { refreshToken: string; provider: string },
            OAuthTokens
        >(functions, 'emailRefreshToken');

        const result = await refreshFn({ refreshToken, provider: 'gmail' });
        return result.data;
    }

    async fetchMessages(
        accessToken: string,
        options: EmailSyncOptions = {}
    ): Promise<EmailSyncResult> {
        const { maxResults = 30, pageToken, query, after } = options;

        // Build Gmail search query
        let q = query || '';
        if (after) {
            const afterDate = new Date(after);
            q += ` after:${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
        }

        const params = new URLSearchParams({
            maxResults: maxResults.toString(),
            ...(pageToken && { pageToken }),
            ...(q.trim() && { q: q.trim() }),
        });

        // 1. List message IDs
        const listRes = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!listRes.ok) {
            const err = await listRes.text();
            logger.error('[GmailProvider] List messages failed:', err);
            throw new Error(`Gmail API error: ${listRes.status}`);
        }

        const listData = await listRes.json();
        const messageRefs: Array<{ id: string }> = listData.messages || [];

        if (messageRefs.length === 0) {
            return { messages: [], syncedAt: Date.now() };
        }

        // 2. Batch fetch message details (use batch API for efficiency)
        const messages = await Promise.all(
            messageRefs.slice(0, maxResults).map(async (ref) => {
                const msgRes = await fetch(
                    `${GMAIL_API_BASE}/messages/${ref.id}?format=full`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                if (!msgRes.ok) return null;
                const msgData = await msgRes.json();
                return parseGmailMessage(msgData, 'gmail-primary');
            })
        );

        return {
            messages: messages.filter((m): m is EmailMessage => m !== null),
            nextPageToken: listData.nextPageToken || undefined,
            totalEstimate: listData.resultSizeEstimate,
            syncedAt: Date.now(),
        };
    }

    async sendEmail(
        accessToken: string,
        data: ComposeEmailData
    ): Promise<SendEmailResult> {
        // Construct RFC 2822 message
        const _boundary = `boundary_${Date.now()}`;
        const to = data.to.join(', ');
        const cc = data.cc?.join(', ') || '';
        const bcc = data.bcc?.join(', ') || '';

        let rawMessage = [
            `To: ${to}`,
            cc ? `Cc: ${cc}` : '',
            bcc ? `Bcc: ${bcc}` : '',
            `Subject: ${data.subject}`,
            'MIME-Version: 1.0',
            `Content-Type: ${data.isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
            '',
            data.body,
        ]
            .filter(Boolean)
            .join('\r\n');

        // Add threading headers for replies
        if (data.inReplyTo) {
            rawMessage = `In-Reply-To: ${data.inReplyTo}\r\nReferences: ${data.inReplyTo}\r\n${rawMessage}`;
        }

        // Base64url encode
        const encoded = btoa(unescape(encodeURIComponent(rawMessage)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const body: Record<string, string> = { raw: encoded };
        if (data.threadId) {
            body.threadId = data.threadId;
        }

        const res = await fetch(`${GMAIL_API_BASE}/messages/send`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            logger.error('[GmailProvider] Send email failed:', err);
            return { success: false, error: `Gmail send failed: ${res.status}` };
        }

        const result = await res.json();
        return { success: true, messageId: result.id };
    }

    async markAsRead(accessToken: string, messageId: string): Promise<void> {
        await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
        });
    }

    async toggleStar(
        accessToken: string,
        messageId: string,
        starred: boolean
    ): Promise<void> {
        const body = starred
            ? { addLabelIds: ['STARRED'] }
            : { removeLabelIds: ['STARRED'] };

        await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    }

    async trashMessage(accessToken: string, messageId: string): Promise<void> {
        await fetch(`${GMAIL_API_BASE}/messages/${messageId}/trash`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
        });
    }

    async getMessage(
        accessToken: string,
        messageId: string
    ): Promise<EmailMessage> {
        const res = await fetch(
            `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!res.ok) {
            throw new Error(`Gmail API error: ${res.status}`);
        }

        const data = await res.json();
        return parseGmailMessage(data, 'gmail-primary');
    }
}
