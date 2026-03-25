 
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
import { auth, db } from '@/services/firebase';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, orderBy, limit, Unsubscribe } from 'firebase/firestore';
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
    OAuthTokens,
} from './types';

// ---------------------------------------------------------------------------
// Token Cache (in-memory only — never persisted client-side)
// ---------------------------------------------------------------------------

interface TokenCacheEntry {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    provider: EmailProvider;
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

    // -----------------------------------------------------------------------
    // OAuth Flow
    // -----------------------------------------------------------------------

    /**
     * Start the OAuth flow for a provider.
     * Opens a popup window for the user to grant access.
     */
    async connectAccount(provider: EmailProvider): Promise<void> {
        const providerImpl = providers[provider];
        const authUrl = providerImpl.getAuthUrl();

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
            const interval = setInterval(() => {
                try {
                    if (popup.closed) {
                        clearInterval(interval);
                        // Check if we got a token (the callback would have stored it)
                        const userId = auth.currentUser?.uid;
                        if (userId) {
                            const accountDoc = doc(db, 'users', userId, 'emailAccounts', provider);
                            getDoc(accountDoc).then(snap => {
                                if (snap.exists() && snap.data()?.isConnected) {
                                    resolve();
                                } else {
                                    reject(new Error('Connection was cancelled or failed'));
                                }
                            });
                        }
                        return;
                    }

                    // Check if popup has navigated to our callback URL
                    const popupUrl = popup.location?.href;
                    if (popupUrl?.includes('/auth/') && popupUrl?.includes('code=')) {
                        clearInterval(interval);
                        const url = new URL(popupUrl);
                        const code = url.searchParams.get('code');
                        popup.close();

                        if (code) {
                            this.handleAuthCallback(provider, code)
                                .then(resolve)
                                .catch(reject);
                        } else {
                            reject(new Error('No auth code received'));
                        }
                    }
                } catch {
                    // Cross-origin access error — popup hasn't redirected yet
                }
            }, 500);

            // Timeout after 5 minutes
            setTimeout(() => {
                clearInterval(interval);
                if (!popup.closed) popup.close();
                reject(new Error('Authentication timed out'));
            }, 5 * 60 * 1000);
        });
    }

    /**
     * Handle the OAuth callback — exchange code for tokens and store account.
     */
    async handleAuthCallback(provider: EmailProvider, code: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User not authenticated');

        const providerImpl = providers[provider];
        const tokens = await providerImpl.exchangeCode(code);

        // Cache the access token in memory
        tokenCache.set(provider, {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            provider,
        });

        // Fetch basic profile info to get the email address
        let email = '';
        let displayName = '';
        let avatarUrl = '';

        if (provider === 'gmail') {
            try {
                const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
                    headers: { Authorization: `Bearer ${tokens.accessToken}` },
                });
                const profile = await profileRes.json();
                email = profile.emailAddress || '';
            } catch {
                email = auth.currentUser?.email || '';
            }
            displayName = auth.currentUser?.displayName || email;
            avatarUrl = auth.currentUser?.photoURL || '';
        } else if (provider === 'outlook') {
            try {
                const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
                    headers: { Authorization: `Bearer ${tokens.accessToken}` },
                });
                const profile = await profileRes.json();
                email = profile.mail || profile.userPrincipalName || '';
                displayName = profile.displayName || email;
            } catch {
                email = '';
            }
        }

        // Store account metadata in Firestore
        const account: EmailAccount = {
            id: provider,
            provider,
            email,
            displayName,
            avatarUrl,
            isConnected: true,
            lastSyncAt: null,
        };

        await setDoc(
            doc(db, 'users', userId, 'emailAccounts', provider),
            account,
            { merge: true }
        );

        logger.info(`[EmailService] Connected ${provider} account: ${email}`);
    }

    /**
     * Disconnect an email account.
     */
    async disconnectAccount(provider: EmailProvider): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        // Clear tokens
        tokenCache.delete(provider);

        // Remove from Firestore
        await deleteDoc(doc(db, 'users', userId, 'emailAccounts', provider));

        // Clear cached messages
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
        const cached = tokenCache.get(provider);

        if (cached && cached.expiresAt > Date.now() + 60_000) {
            // Token is valid for at least 1 more minute
            return cached.accessToken;
        }

        // Token expired or not cached — refresh via Cloud Function
        if (cached?.refreshToken) {
            const providerImpl = providers[provider];
            const newTokens = await providerImpl.refreshAccessToken(cached.refreshToken);

            tokenCache.set(provider, {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken || cached.refreshToken,
                expiresAt: newTokens.expiresAt,
                provider,
            });

            return newTokens.accessToken;
        }

        throw new Error(`No credentials for ${provider}. Please connect your account.`);
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
        const userId = auth.currentUser?.uid;
        if (!userId) return [];

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
        const userId = auth.currentUser?.uid;
        if (!userId) return null;

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
        return this.messageCache.get(provider) || [];
    }

    /**
     * Get all cached messages across all providers, sorted by date.
     */
    getAllCachedMessages(): EmailMessage[] {
        const all: EmailMessage[] = [];
        for (const messages of this.messageCache.values()) {
            all.push(...messages);
        }
        return all.sort((a, b) => b.date - a.date);
    }
}

export const EmailService = new EmailServiceImpl();
