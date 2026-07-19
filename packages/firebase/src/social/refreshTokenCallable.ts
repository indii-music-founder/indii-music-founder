/**
 * Cloud Function: refreshSocialToken
 *
 * Securely refresh OAuth2 access tokens for all social platforms.
 * Client-side code cannot safely store or use client secrets.
 * This function holds secrets and performs token exchanges server-side.
 *
 * Request: { platform: 'twitter'|'instagram'|'tiktok'|'youtube'|'spotify', refreshToken: string }
 * Response: { accessToken: string, expiresIn: number, newRefreshToken?: string }
 */

import * as functions from 'firebase-functions/v1';
import { spotifyClientId, spotifyClientSecret, tiktokClientKey, tiktokClientSecret, metaAppId, metaAppSecret, twitterClientId, twitterClientSecret, googleOAuthClientId, googleOAuthClientSecret } from '../config/secrets';
import { validateAppCheckV1 } from '../middleware/appCheck';

type SocialPlatform = 'twitter' | 'instagram' | 'tiktok' | 'youtube' | 'spotify';

interface RefreshTokenRequest {
    platform: SocialPlatform;
    refreshToken: string;
}

interface RefreshTokenResponse {
    accessToken: string;
    expiresIn: number;
    newRefreshToken?: string;
}

async function fetchTokenResponse(
    url: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    additionalParams: Record<string, string> = {}
): Promise<RefreshTokenResponse> {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        ...additionalParams,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Token refresh failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as any;
    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in || 3600,
        newRefreshToken: data.refresh_token,
    };
}

export const refreshSocialToken = functions
    .runWith({ enforceAppCheck: false, secrets: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'META_APP_ID', 'META_APP_SECRET', 'TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'] })
    .https.onCall(async (data: unknown, context): Promise<RefreshTokenResponse> => {
        validateAppCheckV1(context);
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const req = data as RefreshTokenRequest;
        if (!req.platform || !req.refreshToken) {
            throw new functions.https.HttpsError('invalid-argument', 'platform and refreshToken are required');
        }

        try {
            switch (req.platform) {
                case 'spotify':
                    return await fetchTokenResponse(
                        'https://accounts.spotify.com/api/token',
                        spotifyClientId.value(),
                        spotifyClientSecret.value(),
                        req.refreshToken
                    );

                case 'tiktok':
                    return await fetchTokenResponse(
                        'https://open.tiktokapis.com/v2/oauth/token/',
                        tiktokClientKey.value(),
                        tiktokClientSecret.value(),
                        req.refreshToken
                    );

                case 'instagram':
                    return await fetchTokenResponse(
                        'https://graph.facebook.com/v20.0/oauth/access_token',
                        metaAppId.value(),
                        metaAppSecret.value(),
                        req.refreshToken
                    );

                case 'twitter':
                    return await fetchTokenResponse(
                        'https://api.twitter.com/2/oauth2/token',
                        twitterClientId.value(),
                        twitterClientSecret.value(),
                        req.refreshToken
                    );

                case 'youtube':
                    return await fetchTokenResponse(
                        'https://oauth2.googleapis.com/token',
                        googleOAuthClientId.value(),
                        googleOAuthClientSecret.value(),
                        req.refreshToken
                    );

                default:
                    throw new functions.https.HttpsError('invalid-argument', `Unsupported platform: ${req.platform}`);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            if (message.includes('Token refresh failed')) {
                throw new functions.https.HttpsError('permission-denied', `Failed to refresh ${req.platform} token: ${message}`);
            }
            throw new functions.https.HttpsError('internal', `Error refreshing token: ${message}`);
        }
    });
