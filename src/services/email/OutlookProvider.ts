/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
/**
 * Outlook Provider — Uses Microsoft Identity Platform (MSAL) for OAuth
 * and Microsoft Graph API for message operations.
 *
 * Architecture:
 *   1. OAuth: MSAL.js popup flow for auth code
 *   2. Token Refresh: Via Cloud Function (refresh tokens are server-side only)
 *   3. API Calls: Direct REST to graph.microsoft.com from the client
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

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0/me';

const OUTLOOK_SCOPES = [
    'Mail.Read',
    'Mail.Send',
    'Mail.ReadWrite',
    'User.Read',
    'offline_access',
];

/**
 * Parse a Microsoft Graph message into our unified EmailMessage type.
 */
function parseOutlookMessage(raw: any, accountId: string): EmailMessage {
    const parseAddress = (addr: any): EmailAddress => ({
        name: addr?.emailAddress?.name || '',
        email: addr?.emailAddress?.address || '',
    });

    const attachments: EmailAttachment[] = (raw.attachments || []).map((att: any) => ({
        id: att.id,
        filename: att.name || 'attachment',
        mimeType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
    }));

    return {
        id: `outlook_${raw.id}`,
        threadId: raw.conversationId || raw.id,
        provider: 'outlook',
        accountId,
        from: parseAddress(raw.from),
        to: (raw.toRecipients || []).map(parseAddress),
        cc: (raw.ccRecipients || []).map(parseAddress),
        subject: raw.subject || '',
        snippet: raw.bodyPreview || '',
        bodyText: raw.body?.contentType === 'text' ? raw.body?.content : undefined,
        bodyHtml: raw.body?.contentType === 'html' ? raw.body?.content : undefined,
        date: new Date(raw.receivedDateTime || raw.createdDateTime).getTime(),
        isRead: raw.isRead ?? true,
        isStarred: raw.flag?.flagStatus === 'flagged',
        isDraft: raw.isDraft ?? false,
        labels: raw.categories || [],
        attachments,
        providerMessageId: raw.id,
    };
}

export class OutlookProvider implements EmailProviderInterface {
    readonly provider = 'outlook' as const;
    private clientId: string;

    constructor() {
        this.clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
    }

    getAuthUrl(): string {
        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: 'code',
            redirect_uri: `${window.location.origin}/auth/outlook/callback`,
            scope: OUTLOOK_SCOPES.join(' '),
            response_mode: 'query',
            prompt: 'consent',
        });
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokens> {
        const exchangeTokens = httpsCallable<
            { code: string; provider: string },
            OAuthTokens
        >(functions, 'emailExchangeToken');

        const result = await exchangeTokens({ code, provider: 'outlook' });
        return result.data;
    }

    async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
        const refreshFn = httpsCallable<
            { refreshToken: string; provider: string },
            OAuthTokens
        >(functions, 'emailRefreshToken');

        const result = await refreshFn({ refreshToken, provider: 'outlook' });
        return result.data;
    }

    async fetchMessages(
        accessToken: string,
        options: EmailSyncOptions = {}
    ): Promise<EmailSyncResult> {
        const { maxResults = 30, pageToken, query, after } = options;

        let url = `${GRAPH_API_BASE}/messages?$top=${maxResults}&$orderby=receivedDateTime desc`;

        // Add filter for incremental sync
        const filters: string[] = [];
        if (after) {
            filters.push(`receivedDateTime ge ${new Date(after).toISOString()}`);
        }
        if (filters.length > 0) {
            url += `&$filter=${filters.join(' and ')}`;
        }

        // Add search
        if (query) {
            url += `&$search="${query}"`;
        }

        // Pagination
        if (pageToken) {
            url = pageToken; // Graph API returns full next link
        }

        // Select specific fields for efficiency
        url += '&$select=id,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,isDraft,flag,categories,hasAttachments';

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            const err = await res.text();
            logger.error('[OutlookProvider] Fetch messages failed:', err);
            throw new Error(`Graph API error: ${res.status}`);
        }

        const data = await res.json();
        const messages = (data.value || []).map((m: any) =>
            parseOutlookMessage(m, 'outlook-primary')
        );

        return {
            messages,
            nextPageToken: data['@odata.nextLink'] || undefined,
            totalEstimate: data['@odata.count'],
            syncedAt: Date.now(),
        };
    }

    async sendEmail(
        accessToken: string,
        data: ComposeEmailData
    ): Promise<SendEmailResult> {
        const message: any = {
            subject: data.subject,
            body: {
                contentType: data.isHtml ? 'HTML' : 'Text',
                content: data.body,
            },
            toRecipients: data.to.map(email => ({
                emailAddress: { address: email },
            })),
        };

        if (data.cc?.length) {
            message.ccRecipients = data.cc.map(email => ({
                emailAddress: { address: email },
            }));
        }

        if (data.bcc?.length) {
            message.bccRecipients = data.bcc.map(email => ({
                emailAddress: { address: email },
            }));
        }

        const res = await fetch(`${GRAPH_API_BASE}/sendMail`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message, saveToSentItems: true }),
        });

        if (!res.ok) {
            const err = await res.text();
            logger.error('[OutlookProvider] Send email failed:', err);
            return { success: false, error: `Outlook send failed: ${res.status}` };
        }

        return { success: true };
    }

    async markAsRead(accessToken: string, messageId: string): Promise<void> {
        await fetch(`${GRAPH_API_BASE}/messages/${messageId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isRead: true }),
        });
    }

    async toggleStar(
        accessToken: string,
        messageId: string,
        starred: boolean
    ): Promise<void> {
        await fetch(`${GRAPH_API_BASE}/messages/${messageId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                flag: { flagStatus: starred ? 'flagged' : 'notFlagged' },
            }),
        });
    }

    async trashMessage(accessToken: string, messageId: string): Promise<void> {
        await fetch(`${GRAPH_API_BASE}/messages/${messageId}/move`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ destinationId: 'deleteditems' }),
        });
    }

    async getMessage(
        accessToken: string,
        messageId: string
    ): Promise<EmailMessage> {
        const res = await fetch(
            `${GRAPH_API_BASE}/messages/${messageId}?$expand=attachments`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!res.ok) {
            throw new Error(`Graph API error: ${res.status}`);
        }

        const data = await res.json();
        return parseOutlookMessage(data, 'outlook-primary');
    }
}
