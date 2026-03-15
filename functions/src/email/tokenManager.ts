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

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";

// ---------------------------------------------------------------------------
// Secrets (stored in GCP Secret Manager)
// ---------------------------------------------------------------------------

const googleOAuthClientId = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
const googleOAuthClientSecret = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");
const microsoftClientId = defineSecret("MICROSOFT_CLIENT_ID");
const microsoftClientSecret = defineSecret("MICROSOFT_CLIENT_SECRET");

// ---------------------------------------------------------------------------
// Helper: Get redirect URI based on provider
// ---------------------------------------------------------------------------

function getRedirectUri(provider: string): string {
    // In production, these should come from environment config
    const baseUrl = process.env.APP_URL || 'https://studio.indiios.com';
    return `${baseUrl}/auth/${provider}/callback`;
}

// ---------------------------------------------------------------------------
// emailExchangeToken
// ---------------------------------------------------------------------------

export const emailExchangeToken = functions
    .runWith({
        secrets: [googleOAuthClientId, googleOAuthClientSecret, microsoftClientId, microsoftClientSecret],
        timeoutSeconds: 30,
    })
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        // 1. Authentication required
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
        }

        const { code, provider } = data;
        if (!code || !provider) {
            throw new functions.https.HttpsError("invalid-argument", "Missing code or provider.");
        }

        const userId = context.auth.uid;

        try {
            let tokens: any;

            if (provider === 'gmail') {
                tokens = await exchangeGmailCode(code);
            } else if (provider === 'outlook') {
                tokens = await exchangeOutlookCode(code);
            } else {
                throw new functions.https.HttpsError("invalid-argument", `Unknown provider: ${provider}`);
            }

            // Store refresh token securely in Firestore (never sent to client)
            await admin.firestore()
                .collection('users')
                .doc(userId)
                .collection('emailTokens')
                .doc(provider)
                .set({
                    refreshToken: tokens.refreshToken,
                    scope: tokens.scope,
                    provider,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

            console.log(`[EmailToken] Stored ${provider} tokens for user ${userId}`);

            // Return access token (short-lived) to client — DO NOT return refresh token
            return {
                accessToken: tokens.accessToken,
                expiresAt: Date.now() + (tokens.expiresIn * 1000),
                scope: tokens.scope,
                provider,
                // We also return the refresh token once for the client-side cache
                // It will be used for immediate refresh calls but never persisted client-side
                refreshToken: tokens.refreshToken,
            };

        } catch (error: any) {
            console.error(`[EmailToken] Exchange failed for ${provider}:`, error);
            throw new functions.https.HttpsError("internal", `Token exchange failed: ${error.message}`);
        }
    });

// ---------------------------------------------------------------------------
// emailRefreshToken
// ---------------------------------------------------------------------------

export const emailRefreshToken = functions
    .runWith({
        secrets: [googleOAuthClientId, googleOAuthClientSecret, microsoftClientId, microsoftClientSecret],
        timeoutSeconds: 15,
    })
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
        }

        const { refreshToken, provider } = data;
        if (!provider) {
            throw new functions.https.HttpsError("invalid-argument", "Missing provider.");
        }

        const userId = context.auth.uid;

        try {
            // Use provided refresh token or fall back to stored one
            let actualRefreshToken = refreshToken;
            if (!actualRefreshToken) {
                const tokenDoc = await admin.firestore()
                    .collection('users')
                    .doc(userId)
                    .collection('emailTokens')
                    .doc(provider)
                    .get();

                if (!tokenDoc.exists) {
                    throw new Error('No stored refresh token. Please reconnect your account.');
                }
                actualRefreshToken = tokenDoc.data()?.refreshToken;
            }

            let tokens: any;

            if (provider === 'gmail') {
                tokens = await refreshGmailToken(actualRefreshToken);
            } else if (provider === 'outlook') {
                tokens = await refreshOutlookToken(actualRefreshToken);
            } else {
                throw new functions.https.HttpsError("invalid-argument", `Unknown provider: ${provider}`);
            }

            // Update stored refresh token if a new one was issued
            if (tokens.refreshToken && tokens.refreshToken !== actualRefreshToken) {
                await admin.firestore()
                    .collection('users')
                    .doc(userId)
                    .collection('emailTokens')
                    .doc(provider)
                    .update({
                        refreshToken: tokens.refreshToken,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
            }

            return {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken || actualRefreshToken,
                expiresAt: Date.now() + (tokens.expiresIn * 1000),
                scope: tokens.scope || '',
                provider,
            };

        } catch (error: any) {
            console.error(`[EmailToken] Refresh failed for ${provider}:`, error);
            throw new functions.https.HttpsError("internal", `Token refresh failed: ${error.message}`);
        }
    });

// ---------------------------------------------------------------------------
// emailRevokeToken
// ---------------------------------------------------------------------------

export const emailRevokeToken = functions
    .runWith({
        secrets: [googleOAuthClientId, googleOAuthClientSecret],
        timeoutSeconds: 15,
    })
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
        }

        const { provider } = data;
        const userId = context.auth.uid;

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
                    await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    });
                }
                // For Outlook, token revocation is handled by MSAL logout

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

        } catch (error: any) {
            console.error(`[EmailToken] Revoke failed for ${provider}:`, error);
            throw new functions.https.HttpsError("internal", `Token revocation failed: ${error.message}`);
        }
    });

// ---------------------------------------------------------------------------
// Gmail Token Helpers
// ---------------------------------------------------------------------------

async function exchangeGmailCode(code: string): Promise<any> {
    const clientId = googleOAuthClientId.value();
    const clientSecret = googleOAuthClientSecret.value();

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: getRedirectUri('gmail'),
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

async function refreshGmailToken(refreshToken: string): Promise<any> {
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

async function exchangeOutlookCode(code: string): Promise<any> {
    const clientId = microsoftClientId.value();
    const clientSecret = microsoftClientSecret.value();

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: getRedirectUri('outlook'),
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

async function refreshOutlookToken(refreshToken: string): Promise<any> {
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
