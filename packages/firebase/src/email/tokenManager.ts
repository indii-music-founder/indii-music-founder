/**
 * Email OAuth Token Manager — Cloud Functions
 *
 * Handles the server-side OAuth token exchange and refresh for Gmail and Outlook.
 * Refresh tokens are stored encrypted in Firestore and NEVER sent to the client.
 *
 * Functions:
 *   - emailExchangeToken: Exchange auth code → access + refresh tokens
 *   - emailRefreshToken: Refresh an expired access token
 *   - emailRevokeToken: Revoke and delete stored tokens
 */

/** Interface for normalized token results from providers */
interface TokenResult {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    scope: string;
}

interface EmailAccountRecord {
    id: EmailProvider;
    provider: EmailProvider;
    email: string;
    displayName: string;
    avatarUrl: string;
    isConnected: true;
    lastSyncAt: null;
}

type EmailProvider = 'gmail' | 'outlook';

function parseEmailProvider(value: unknown): EmailProvider {
    if (value === 'gmail' || value === 'outlook') return value;
    throw new HttpsError('invalid-argument', 'Provider must be gmail or outlook.');
}

export async function verifyProviderAccount(
    provider: EmailProvider,
    accessToken: string,
    authClaims: Record<string, unknown>,
): Promise<EmailAccountRecord> {
    if (provider === 'gmail') {
        const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error(`Gmail profile verification failed (${response.status}).`);
        const profile = await response.json() as { emailAddress?: unknown };
        const email = typeof profile.emailAddress === 'string' ? profile.emailAddress.trim() : '';
        if (!email) throw new Error('Gmail did not return an account email address.');
        const firebaseEmail = typeof authClaims.email === 'string' ? authClaims.email : '';
        const sameFirebaseIdentity = firebaseEmail.toLowerCase() === email.toLowerCase();
        return {
            id: provider,
            provider,
            email,
            displayName: sameFirebaseIdentity && typeof authClaims.name === 'string' ? authClaims.name : email,
            avatarUrl: sameFirebaseIdentity && typeof authClaims.picture === 'string' ? authClaims.picture : '',
            isConnected: true,
            lastSyncAt: null,
        };
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Outlook profile verification failed (${response.status}).`);
    const profile = await response.json() as {
        mail?: unknown;
        userPrincipalName?: unknown;
        displayName?: unknown;
    };
    const email = typeof profile.mail === 'string' && profile.mail.trim()
        ? profile.mail.trim()
        : typeof profile.userPrincipalName === 'string'
            ? profile.userPrincipalName.trim()
            : '';
    if (!email) throw new Error('Outlook did not return an account email address.');
    return {
        id: provider,
        provider,
        email,
        displayName: typeof profile.displayName === 'string' && profile.displayName.trim()
            ? profile.displayName.trim()
            : email,
        avatarUrl: '',
        isConnected: true,
        lastSyncAt: null,
    };
}


import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { enforceRateLimit } from "../lib/rateLimit";

// Item 328: Token exchange rate limit — 20 req/min per UID
const TOKEN_RATE_LIMIT = { maxRequests: 20, windowMs: 60 * 1000 };

// ---------------------------------------------------------------------------
// Secrets (stored in GCP Secret Manager)
// ---------------------------------------------------------------------------

const googleOAuthClientId = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
const googleOAuthClientSecret = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");
const microsoftClientId = defineSecret("MICROSOFT_CLIENT_ID");
const microsoftClientSecret = defineSecret("MICROSOFT_CLIENT_SECRET");

// ---------------------------------------------------------------------------
// Helper: validate the exact redirect URI used to mint the authorization code
// ---------------------------------------------------------------------------

export function resolveEmailOAuthRedirectUri(
    provider: EmailProvider,
    requestedRedirectUri: unknown,
): string {
    if (typeof requestedRedirectUri !== 'string') {
        throw new HttpsError('invalid-argument', 'Missing OAuth redirect URI.');
    }

    let requested: URL;
    try {
        requested = new URL(requestedRedirectUri);
    } catch {
        throw new HttpsError('invalid-argument', 'OAuth redirect URI is invalid.');
    }

    const expectedPath = `/auth/${provider}/callback`;
    if (requested.pathname !== expectedPath || requested.search || requested.hash || requested.username || requested.password) {
        throw new HttpsError('invalid-argument', 'OAuth redirect URI does not match the provider callback.');
    }

    const allowedOrigins = new Set(['https://app.indii.music']);
    const configuredAppUrl = process.env.APP_URL;
    if (configuredAppUrl) {
        try {
            const configured = new URL(configuredAppUrl);
            if (configured.protocol === 'https:' && configured.pathname === '/' && !configured.search && !configured.hash) {
                allowedOrigins.add(configured.origin);
            }
        } catch {
            console.warn('[EmailToken] Ignoring invalid APP_URL configuration.');
        }
    }

    if (process.env.FUNCTIONS_EMULATOR === 'true'
        && requested.protocol === 'http:'
        && (requested.hostname === 'localhost' || requested.hostname === '127.0.0.1')) {
        return `${requested.origin}${expectedPath}`;
    }

    if (!allowedOrigins.has(requested.origin)) {
        throw new HttpsError('invalid-argument', 'OAuth redirect URI is not an authorized Studio origin.');
    }

    return `${requested.origin}${expectedPath}`;
}

// ---------------------------------------------------------------------------
// emailExchangeToken
// ---------------------------------------------------------------------------

export const emailExchangeToken = onCall(
    {
        enforceAppCheck: true,
        secrets: [googleOAuthClientId, googleOAuthClientSecret, microsoftClientId, microsoftClientSecret],
        timeoutSeconds: 30,
        memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1,
    },
    async (request) => {
        // 1. Authentication required
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        const { code, redirectUri: requestedRedirectUri } = (request.data ?? {}) as {
            code?: string;
            provider?: unknown;
            redirectUri?: unknown;
        };
        if (!code) {
            throw new HttpsError("invalid-argument", "Missing code or provider.");
        }
        const provider = parseEmailProvider((request.data as { provider?: unknown } | undefined)?.provider);
        const redirectUri = resolveEmailOAuthRedirectUri(provider, requestedRedirectUri);

        const userId = request.auth.uid;

        // Item 328: Rate limit token exchange to 20 req/min per UID
        await enforceRateLimit(userId, "emailExchangeToken", TOKEN_RATE_LIMIT);

        try {
            let tokens: TokenResult;

            if (provider === 'gmail') {
                tokens = await exchangeGmailCode(code, redirectUri);
            } else if (provider === 'outlook') {
                tokens = await exchangeOutlookCode(code, redirectUri);
            } else {
                throw new HttpsError("invalid-argument", `Unknown provider: ${provider}`);
            }

            // Store refresh token securely in Firestore (never sent to client)
            if (!tokens.refreshToken) {
                throw new HttpsError('failed-precondition', 'The provider did not issue a refresh token. Reconnect and approve offline access.');
            }
            const firestore = admin.firestore();
            const userRef = firestore.collection('users').doc(userId);
            const tokenRef = userRef.collection('emailTokens').doc(provider);
            const accountRef = userRef.collection('emailAccounts').doc(provider);
            const authClaims = request.auth?.token ?? {};
            // Definite assignment: storeTokens() always assigns before the
            // loop below exits successfully, and the return only runs after.
            let account!: EmailAccountRecord;
            const storeTokens = async (): Promise<void> => {
                account = await verifyProviderAccount(provider, tokens.accessToken, authClaims);
                const batch = firestore.batch();
                batch.set(tokenRef, {
                    refreshToken: tokens.refreshToken,
                    scope: tokens.scope,
                    provider,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                batch.set(accountRef, account, { merge: true });
                await batch.commit();
            };

            // The authorization code is single-use: once the provider exchange
            // above succeeded, a transient Firestore or profile-verification
            // failure must not force the user to redo the whole OAuth flow.
            // The batch is idempotent (set, not create), so retrying it is safe.
            const MAX_STORE_ATTEMPTS = 3;
            for (let attempt = 1; attempt <= MAX_STORE_ATTEMPTS; attempt += 1) {
                try {
                    await storeTokens();
                    break;
                } catch (storageError) {
                    if (attempt === MAX_STORE_ATTEMPTS) throw storageError;
                    console.warn(`[EmailToken] Token storage attempt ${attempt}/${MAX_STORE_ATTEMPTS} failed — retrying:`, storageError);
                    await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
                }
            }

            console.log(`[EmailToken] Stored ${provider} tokens for user ${userId}`);

            // Return access token (short-lived) to client — DO NOT return refresh token
            return {
                accessToken: tokens.accessToken,
                expiresAt: Date.now() + (tokens.expiresIn * 1000),
                scope: tokens.scope,
                provider,
                account,
            };

        } catch (error: unknown) {
            // The unknown-provider throw above is raised inside this try, and
            // this catch previously had no pass-through, so that actionable
            // invalid-argument was being relabelled 'internal'. Re-throw
            // HttpsError unchanged. Pre-existing defect, unrelated to the
            // generation change - v1 and v2 share one HttpsError class.
            if (error instanceof HttpsError) throw error;
            const err = error as Error;
            console.error(`[EmailToken] Exchange failed for ${provider}:`, err);
            throw new HttpsError("internal", `Token exchange failed: ${err.message}`);
        }
    });

// ---------------------------------------------------------------------------
// emailRefreshToken
// ---------------------------------------------------------------------------

export const emailRefreshToken = onCall(
    {
        enforceAppCheck: true,
        secrets: [googleOAuthClientId, googleOAuthClientSecret, microsoftClientId, microsoftClientSecret],
        timeoutSeconds: 15,
        memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        const provider = parseEmailProvider((request.data as { provider?: unknown } | undefined)?.provider);

        const userId = request.auth.uid;

        // Item 328: Rate limit token refresh to 20 req/min per UID
        await enforceRateLimit(userId, "emailRefreshToken", TOKEN_RATE_LIMIT);

        try {
            // Refresh credentials remain server-owned. Never accept a client-
            // supplied refresh token and never return one to the browser.
            const tokenDoc = await admin.firestore()
                .collection('users')
                .doc(userId)
                .collection('emailTokens')
                .doc(provider)
                .get();

            if (!tokenDoc.exists) {
                throw new HttpsError('not-found', 'No stored refresh token. Please reconnect your account.');
            }
            const actualRefreshToken = tokenDoc.data()?.refreshToken as string | undefined;

            if (!actualRefreshToken) {
                throw new HttpsError("not-found", "Refresh token was not found for this provider.");
            }

            let tokens: TokenResult;

            if (provider === 'gmail') {
                tokens = await refreshGmailToken(actualRefreshToken);
            } else if (provider === 'outlook') {
                tokens = await refreshOutlookToken(actualRefreshToken);
            } else {
                throw new HttpsError("invalid-argument", `Unknown provider: ${provider}`);
            }

            // Update stored refresh token if a new one was issued. The write is
            // a compare-and-swap: a concurrent refresh (another device, a
            // retry) may already have rotated the stored token while this call
            // was in flight. Overwriting unconditionally could clobber the
            // newer credential; the stored token stays authoritative and this
            // call still returns its own (valid) access token.
            if (tokens.refreshToken && tokens.refreshToken !== actualRefreshToken) {
                const tokenRef = admin.firestore()
                    .collection('users')
                    .doc(userId)
                    .collection('emailTokens')
                    .doc(provider);
                await admin.firestore().runTransaction(async (tx) => {
                    const freshSnap = await tx.get(tokenRef);
                    if (!freshSnap.exists) return; // removed concurrently
                    if (freshSnap.data()?.refreshToken !== actualRefreshToken) {
                        console.warn(`[EmailToken] Concurrent refresh already rotated ${provider} tokens — keeping the newer stored token.`);
                        return;
                    }
                    tx.update(tokenRef, {
                        refreshToken: tokens.refreshToken,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                });
            }

            return {
                accessToken: tokens.accessToken,
                expiresAt: Date.now() + (tokens.expiresIn * 1000),
                scope: tokens.scope || '',
                provider,
            };

        } catch (error: unknown) {
            // The unknown-provider throw above is raised inside this try, and
            // this catch previously had no pass-through, so that actionable
            // invalid-argument was being relabelled 'internal'. Re-throw
            // HttpsError unchanged. Pre-existing defect, unrelated to the
            // generation change - v1 and v2 share one HttpsError class.
            if (error instanceof HttpsError) throw error;
            const err = error as Error;
            console.error(`[EmailToken] Refresh failed for ${provider}:`, err);
            throw new HttpsError("internal", `Token refresh failed: ${err.message}`);
        }
    });

// ---------------------------------------------------------------------------
// emailRevokeToken
// ---------------------------------------------------------------------------

export const emailRevokeToken = onCall(
    {
        enforceAppCheck: true,
        secrets: [googleOAuthClientId, googleOAuthClientSecret],
        timeoutSeconds: 15,
        memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        const provider = parseEmailProvider((request.data as { provider?: unknown } | undefined)?.provider);
        const userId = request.auth.uid;

        try {
            // Get stored token
            const tokenRef = admin.firestore()
                .collection('users')
                .doc(userId)
                .collection('emailTokens')
                .doc(provider);

            const tokenDoc = await tokenRef.get();

            if (tokenDoc.exists) {
                const refreshToken = tokenDoc.data()?.refreshToken;

                // Revoke with provider
                if (provider === 'gmail' && refreshToken) {
                    const revokeResponse = await fetch('https://oauth2.googleapis.com/revoke', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ token: refreshToken }),
                    });
                    if (!revokeResponse.ok) {
                        throw new HttpsError('unavailable', 'Google did not accept the token revocation. Try again.');
                    }
                }
                // Microsoft does not expose a comparable refresh-token revoke
                // endpoint here. Deleting the server-held credential prevents
                // this app from refreshing it again.

                // Delete stored token
                await tokenRef.delete();
            }

            // Delete account record
            await admin.firestore()
                .collection('users')
                .doc(userId)
                .collection('emailAccounts')
                .doc(provider)
                .delete();

            console.log(`[EmailToken] Revoked ${provider} tokens for user ${userId}`);
            return { success: true };

        } catch (error: unknown) {
            if (error instanceof HttpsError) throw error;
            const err = error as Error;
            console.error(`[EmailToken] Revoke failed for ${provider}:`, err);
            throw new HttpsError("internal", `Token revocation failed: ${err.message}`);
        }
    });

// ---------------------------------------------------------------------------
// Gmail Token Helpers
// ---------------------------------------------------------------------------

async function exchangeGmailCode(code: string, redirectUri: string): Promise<TokenResult> {
    const clientId = googleOAuthClientId.value();
    const clientSecret = googleOAuthClientSecret.value();

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }).toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gmail token exchange failed: ${err}`);
    }

    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600,
        scope: data.scope || '',
    };
}

async function refreshGmailToken(refreshToken: string): Promise<TokenResult> {
    const clientId = googleOAuthClientId.value();
    const clientSecret = googleOAuthClientSecret.value();

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
        }).toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gmail token refresh failed: ${err}`);
    }

    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // May be null (Gmail doesn't always reissue)
        expiresIn: data.expires_in || 3600,
        scope: data.scope || '',
    };
}

// ---------------------------------------------------------------------------
// Outlook Token Helpers
// ---------------------------------------------------------------------------

async function exchangeOutlookCode(code: string, redirectUri: string): Promise<TokenResult> {
    const clientId = microsoftClientId.value();
    const clientSecret = microsoftClientSecret.value();

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }).toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Outlook token exchange failed: ${err}`);
    }

    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600,
        scope: data.scope || '',
    };
}

async function refreshOutlookToken(refreshToken: string): Promise<TokenResult> {
    const clientId = microsoftClientId.value();
    const clientSecret = microsoftClientSecret.value();

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
        }).toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Outlook token refresh failed: ${err}`);
    }

    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // Outlook always reissues
        expiresIn: data.expires_in || 3600,
        scope: data.scope || '',
    };
}
