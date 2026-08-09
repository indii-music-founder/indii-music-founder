
/**
 * EmailService — Unified Email Facade
 *
 * Orchestrates Gmail and Outlook providers behind a single interface.
 * Handles:
 *   - Provider registration and token lifecycle
 *   - Message caching and sync
 *   - Compose / reply / forward
 *
 * Security model:
 *   - Access tokens held in memory only (never persisted client-side)
 *   - Refresh tokens stored in Firestore via Cloud Functions
 *   - Token refresh is automatic and transparent
 */

import { logger } from '@/utils/logger';
import { auth, db, functions } from '@/services/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { GmailProvider } from './GmailProvider';
import { OutlookProvider } from './OutlookProvider';
import type {
    EmailProvider,
    EmailAccount,
    EmailMessage,
    EmailSyncOptions,
    EmailSyncResult,
    ComposeEmailData,
    SendEmailResult,
    EmailProviderInterface,
} from './types';
import {
    beginAccountBoundOAuthSession,
    clearAccountBoundOAuthSession,
    requireAccountBoundOAuthSession,
} from '@/services/auth/AccountBoundOAuthSession';

// ---------------------------------------------------------------------------
// Token Cache (in-memory only — never persisted client-side)
// ---------------------------------------------------------------------------

interface TokenCacheEntry {
    accessToken: string;
    expiresAt: number;
    provider: EmailProvider;
    ownerUid: string;
}

const tokenCache = new Map<string, TokenCacheEntry>();

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

const providers: Record<EmailProvider, EmailProviderInterface> = {
    gmail: new GmailProvider(),
    outlook: new OutlookProvider(),
};

// ---------------------------------------------------------------------------
// EmailService Singleton
// ---------------------------------------------------------------------------

class EmailServiceImpl {
    private syncSubscriptions = new Map<string, Unsubscribe>();
    private messageCache = new Map<string, EmailMessage[]>();
    private cacheOwnerUid: string | null = null;

    private ensureCacheOwner(): string {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            this.clearSession();
            throw new Error('User not authenticated');
        }
        if (this.cacheOwnerUid !== uid) {
            this.clearSession();
            this.cacheOwnerUid = uid;
        }
        return uid;
    }

    clearSession(): void {
        tokenCache.clear();
        this.messageCache.clear();
        for (const unsubscribe of this.syncSubscriptions.values()) unsubscribe();
        this.syncSubscriptions.clear();
        this.cacheOwnerUid = null;
    }

    // -----------------------------------------------------------------------
    // OAuth Flow
    // -----------------------------------------------------------------------

    /**
     * Start the OAuth flow for a provider.
     * Opens a popup window for the user to grant access.
     */
    async connectAccount(provider: EmailProvider): Promise<void> {
        if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
            window.open('https://app.indii.music', '_blank', 'noopener,noreferrer');
            throw new Error('Connect email at app.indii.music in your browser. The desktop app will sync the connection afterward.');
        }
        const initiatingUid = this.ensureCacheOwner();
        const providerImpl = providers[provider];
        const oauthSession = beginAccountBoundOAuthSession(provider, initiatingUid);
        const authUrl = providerImpl.getAuthUrl(oauthSession.state);

        // Open popup for OAuth
        const popup = window.open(
            authUrl,
            `Connect ${provider}`,
            'width=500,height=700,left=200,top=100'
        );

        if (!popup) {
            throw new Error('Popup blocked. Please allow popups for this site.');
        }

        // Listen for the callback
        return new Promise<void>((resolve, reject) => {
            let settled = false;
            const finish = (error?: Error) => {
                if (settled) return;
                settled = true;
                clearInterval(interval);
                clearTimeout(timeoutId);
                if (error) reject(error);
                else resolve();
            };
            const interval = setInterval(() => {
                try {
                    if (popup.closed) {
                        // Check if we got a token (the callback would have stored it)
                        const userId = auth.currentUser?.uid;
                        if (userId === initiatingUid) {
                            const accountDoc = doc(db, 'users', userId, 'emailAccounts', provider);
                            getDoc(accountDoc).then(snap => {
                                if (snap.exists() && snap.data()?.isConnected) {
                                    finish();
                                } else {
                                    finish(new Error('Connection was cancelled or failed'));
                                }
                            }).catch(error => finish(error instanceof Error ? error : new Error('Connection status check failed')));
                        } else {
                            finish(new Error('The signed-in account changed during authorization.'));
                        }
                        return;
                    }

                    // Check if popup has navigated to our callback URL
                    const popupUrl = popup.location?.href;
                    if (popupUrl?.includes('/auth/') && popupUrl?.includes('code=')) {
                        const url = new URL(popupUrl);
                        const code = url.searchParams.get('code');
                        const returnedState = url.searchParams.get('state') ?? '';
                        popup.close();

                        if (code) {
                            try {
                                requireAccountBoundOAuthSession(provider, returnedState, auth.currentUser?.uid);
                            } catch (error) {
                                finish(error instanceof Error ? error : new Error('OAuth state validation failed'));
                                return;
                            }
                            this.handleAuthCallback(provider, code, initiatingUid)
                                .then(() => finish())
                                .catch(error => finish(error instanceof Error ? error : new Error('Account connection failed')));
                        } else {
                            finish(new Error('No auth code received'));
                        }
                    }
                } catch {
                    // Cross-origin access error — popup hasn't redirected yet
                }
            }, 500);

            // Timeout after 5 minutes
            const timeoutId = setTimeout(() => {
                if (!popup.closed) popup.close();
                finish(new Error('Authentication timed out'));
            }, 5 * 60 * 1000);
        });
    }

    /**
     * Handle the OAuth callback — exchange code for tokens and store account.
     */
    async handleAuthCallback(provider: EmailProvider, code: string, initiatingUid: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId || userId !== initiatingUid) {
            throw new Error('The signed-in account changed during authorization.');
        }

        const providerImpl = providers[provider];
        const redirectUri = `${window.location.origin}/auth/${provider}/callback`;
        const tokens = await providerImpl.exchangeCode(code, redirectUri);
        if (auth.currentUser?.uid !== initiatingUid) {
            throw new Error('The signed-in account changed during authorization.');
        }
        if (tokens.account.provider !== provider || !tokens.account.email || !tokens.account.isConnected) {
            throw new Error(`The ${provider} account could not be verified.`);
        }

        // Cache the access token in memory
        tokenCache.set(provider, {
            accessToken: tokens.accessToken,
            expiresAt: tokens.expiresAt,
            provider,
            ownerUid: userId,
        });
        this.cacheOwnerUid = userId;

        clearAccountBoundOAuthSession(provider);

        logger.info(`[EmailService] Connected ${provider} account: ${tokens.account.email}`);
    }

    /**
     * Disconnect an email account.
     */
    async disconnectAccount(provider: EmailProvider): Promise<void> {
        this.ensureCacheOwner();

        // The refresh credential and connection record are backend-owned. A
        // direct client delete is denied by Firestore rules and would leave the
        // durable refresh token active.
        const revokeToken = httpsCallable<{ provider: EmailProvider }, { success: boolean }>(
            functions,
            'emailRevokeToken',
        );
        const result = await revokeToken({ provider });
        if (!result.data.success) throw new Error(`Failed to revoke the ${provider} connection.`);

        tokenCache.delete(provider);
        this.messageCache.delete(provider);

        // Cancel sync subscription
        const unsub = this.syncSubscriptions.get(provider);
        if (unsub) {
            unsub();
            this.syncSubscriptions.delete(provider);
        }

        logger.info(`[EmailService] Disconnected ${provider} account`);
    }

    // -----------------------------------------------------------------------
    // Token Management
    // -----------------------------------------------------------------------

    /**
     * Get a valid access token for a provider, refreshing if needed.
     */
    private async getAccessToken(provider: EmailProvider): Promise<string> {
        const userId = this.ensureCacheOwner();
        const cached = tokenCache.get(provider);

        if (cached && cached.ownerUid === userId && cached.expiresAt > Date.now() + 60_000) {
            // Token is valid for at least 1 more minute
            return cached.accessToken;
        }

        // Token expired or not cached — refresh via Cloud Function
        {
            const providerImpl = providers[provider];
            const newTokens = await providerImpl.refreshAccessToken();

            tokenCache.set(provider, {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
                provider,
                ownerUid: userId,
            });

            return newTokens.accessToken;
        }
    }

    // -----------------------------------------------------------------------
    // Message Operations
    // -----------------------------------------------------------------------

    /**
     * Fetch messages from a provider.
     */
    async fetchMessages(
        provider: EmailProvider,
        options?: EmailSyncOptions
    ): Promise<EmailSyncResult> {
        const accessToken = await this.getAccessToken(provider);
        const providerImpl = providers[provider];
        const result = await providerImpl.fetchMessages(accessToken, options);

        // Update cache
        this.messageCache.set(provider, result.messages);

        // Update lastSyncAt in Firestore
        const userId = auth.currentUser?.uid;
        if (userId) {
            await setDoc(
                doc(db, 'users', userId, 'emailAccounts', provider),
                { lastSyncAt: result.syncedAt },
                { merge: true }
            );
        }

        return result;
    }

    /**
     * Send an email via the appropriate provider.
     */
    async sendEmail(data: ComposeEmailData): Promise<SendEmailResult> {
        // Determine provider from accountId
        const provider: EmailProvider = data.accountId.startsWith('outlook')
            ? 'outlook'
            : 'gmail';

        const accessToken = await this.getAccessToken(provider);
        const providerImpl = providers[provider];
        return providerImpl.sendEmail(accessToken, data);
    }

    /**
     * Mark a message as read.
     */
    async markAsRead(provider: EmailProvider, providerMessageId: string): Promise<void> {
        const accessToken = await this.getAccessToken(provider);
        await providers[provider].markAsRead(accessToken, providerMessageId);
    }

    /**
     * Toggle star on a message.
     */
    async toggleStar(
        provider: EmailProvider,
        providerMessageId: string,
        starred: boolean
    ): Promise<void> {
        const accessToken = await this.getAccessToken(provider);
        await providers[provider].toggleStar(accessToken, providerMessageId, starred);
    }

    /**
     * Trash a message.
     */
    async trashMessage(provider: EmailProvider, providerMessageId: string): Promise<void> {
        const accessToken = await this.getAccessToken(provider);
        await providers[provider].trashMessage(accessToken, providerMessageId);
    }

    /**
     * Get a single message with full body.
     */
    async getMessage(provider: EmailProvider, providerMessageId: string): Promise<EmailMessage> {
        const accessToken = await this.getAccessToken(provider);
        return providers[provider].getMessage(accessToken, providerMessageId);
    }

    // -----------------------------------------------------------------------
    // Account Management
    // -----------------------------------------------------------------------

    /**
     * Get all connected email accounts for the current user.
     */
    async getConnectedAccounts(): Promise<EmailAccount[]> {
        const userId = this.ensureCacheOwner();

        const accountsRef = collection(db, 'users', userId, 'emailAccounts');
        const snap = await import('firebase/firestore').then(m => m.getDocs(accountsRef));

        return snap.docs
            .map(d => d.data() as EmailAccount)
            .filter(a => a.isConnected);
    }

    /**
     * Subscribe to email account changes for real-time UI updates.
     */
    subscribeToAccounts(
        callback: (accounts: EmailAccount[]) => void
    ): Unsubscribe | null {
        let userId: string;
        try {
            userId = this.ensureCacheOwner();
        } catch {
            return null;
        }

        const accountsRef = collection(db, 'users', userId, 'emailAccounts');
        return onSnapshot(accountsRef, (snap) => {
            const accounts = snap.docs
                .map(d => d.data() as EmailAccount)
                .filter(a => a.isConnected);
            callback(accounts);
        });
    }

    /**
     * Get cached messages (from last fetch, not a new API call).
     */
    getCachedMessages(provider: EmailProvider): EmailMessage[] {
        try {
            this.ensureCacheOwner();
        } catch {
            return [];
        }
        return this.messageCache.get(provider) || [];
    }

    /**
     * Get all cached messages across all providers, sorted by date.
     */
    getAllCachedMessages(): EmailMessage[] {
        try {
            this.ensureCacheOwner();
        } catch {
            return [];
        }
        const all: EmailMessage[] = [];
        for (const messages of this.messageCache.values()) {
            all.push(...messages);
        }
        return all.sort((a, b) => b.date - a.date);
    }
}

export const EmailService = new EmailServiceImpl();
