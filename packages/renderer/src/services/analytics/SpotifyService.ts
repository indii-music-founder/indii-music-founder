/**
 * SpotifyService — Spotify Web API Integration
 *
 * OAuth 2.0 with PKCE (Proof Key for Code Exchange).
 * No client_secret is needed client-side — the PKCE flow is browser-safe.
 * Token refresh is handled server-side via the `analyticsRefreshToken` Cloud Function.
 *
 * Scope requested:
 *   user-read-private — Account type verification
 *
 * NOTE: Full streaming analytics (raw stream counts, save rates, completion rates
 * as seen in Spotify for Artists) require Spotify for Artists API access, which
 * is available only to approved distributors/partners. The Web API provides
 * aggregate popularity scores, but not Spotify for Artists performance data.
 *
 * Firestore token path: users/{uid}/analyticsTokens/spotify
 */

import { functions as firebaseFunctions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { auth } from '@/services/firebase';
import * as Sentry from '@sentry/react';
import { logger } from '@/utils/logger';

// ── PKCE helpers ──────────────────────────────────────────────────────────────

async function generateCodeVerifier(): Promise<string> {
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoded = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';
const SPOTIFY_SCOPES = [
    'user-read-private',
].join(' ');

// ── Spotify Web API response types ───────────────────────────────────────────

interface SpotifyTrack {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    album: {
        name: string;
        release_date: string;
        images: { url: string; width: number; height: number }[];
    };
    popularity: number;          // 0-100 Spotify popularity index
    duration_ms: number;
    external_urls: { spotify: string };
}

export interface SpotifyArtist {
    id: string;
    name: string;
    popularity: number;
    genres: string[];
    followers: { total: number };
    images: { url: string; width: number; height: number }[];
    external_urls: { spotify: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// SpotifyService
// ─────────────────────────────────────────────────────────────────────────────

export class SpotifyService {
    private redirectUri = `${window.location.origin}/auth/spotify/callback`;

    // ── OAuth / Connection ────────────────────────────────────────────────────

    /**
     * Initiate the PKCE authorization flow.
     * Stores the code_verifier in sessionStorage and redirects to Spotify.
     */
    async initiateOAuth(): Promise<void> {
        if (!SPOTIFY_CLIENT_ID) {
            throw new Error('VITE_SPOTIFY_CLIENT_ID is not configured. Add it to your .env file.');
        }

        const verifier = await generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);
        const state = crypto.randomUUID();

        sessionStorage.setItem('spotify_pkce_verifier', verifier);
        sessionStorage.setItem('spotify_oauth_state', state);

        const params = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            response_type: 'code',
            redirect_uri: this.redirectUri,
            scope: SPOTIFY_SCOPES,
            code_challenge_method: 'S256',
            code_challenge: challenge,
            state,
        });

        window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    /**
     * Handle the OAuth callback — exchange code for tokens via Cloud Function.
     * Call this when the app loads at /auth/spotify/callback.
     */
    async handleCallback(code: string, state: string): Promise<void> {
        const storedState = sessionStorage.getItem('spotify_oauth_state');
        const verifier = sessionStorage.getItem('spotify_pkce_verifier');

        if (state !== storedState) {
            throw new Error('OAuth state mismatch — possible CSRF attack.');
        }
        if (!verifier) {
            throw new Error('PKCE verifier not found in session storage.');
        }

        const exchangeFn = httpsCallable<unknown, { ok: boolean }>(
            firebaseFunctions, 'analyticsExchangeToken'
        );

        await exchangeFn({
            platform: 'spotify',
            code,
            redirectUri: this.redirectUri,
            codeVerifier: verifier,
        });

        sessionStorage.removeItem('spotify_pkce_verifier');
        sessionStorage.removeItem('spotify_oauth_state');
    }

    /**
     * Disconnect Spotify — revokes token and removes from Firestore.
     */
    async disconnect(): Promise<void> {
        const revokeFn = httpsCallable(firebaseFunctions, 'analyticsRevokeToken');
        await revokeFn({ platform: 'spotify' });
    }

    /**
     * Check if Spotify is connected and token is valid.
     */
    async isConnected(): Promise<boolean> {
        const uid = auth.currentUser?.uid;
        if (!uid) return false;
        try {
            const statusFn = httpsCallable<unknown, { connected?: boolean }>(
                firebaseFunctions, 'analyticsGetConnectionStatus'
            );
            const result = await statusFn({ platform: 'spotify' });
            return result.data.connected === true;
        } catch (err: unknown) {
            logger.error('[SpotifyService] Failed to check connection:', err);
            Sentry.captureException(err);
            return false;
        }
    }

    // ── Data fetching ─────────────────────────────────────────────────────────

    /**
     * Get a single track by ID.
     * indii Growth Protocol: Used for popularity score fetching.
     */
    async getTrack(trackId: string): Promise<SpotifyTrack | null> {
        try {
            const token = await this._getValidToken();
            return await this._fetch<SpotifyTrack>(`/v1/tracks/${trackId}`, token);
        } catch (err: unknown) {
            logger.error('[SpotifyService] Failed to get track:', err);
            Sentry.captureException(err);
            return null;
        }
    }

    /**
     * Get an artist by ID.
     * indii Growth Protocol: Used for artist popularity score fetching.
     */
    async getArtist(artistId: string): Promise<SpotifyArtist | null> {
        try {
            const token = await this._getValidToken();
            return await this._fetch<SpotifyArtist>(`/v1/artists/${artistId}`, token);
        } catch (err: unknown) {
            logger.error('[SpotifyService] Failed to get artist:', err);
            Sentry.captureException(err);
            return null;
        }
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private async _getValidToken(): Promise<string> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated.');

        const refreshFn = httpsCallable<unknown, { ok: boolean; accessToken: string; expiresAt: number }>(
            firebaseFunctions, 'analyticsRefreshToken'
        );
        const result = await refreshFn({ platform: 'spotify' });
        if (!result.data.accessToken) throw new Error('Spotify not connected.');
        return result.data.accessToken;
    }

    private async _fetch<T>(path: string, token: string): Promise<T> {
        const res = await fetch(`https://api.spotify.com${path}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15_000),
        });

        if (res.status === 401) {
            throw new Error('Spotify token expired — please reconnect.');
        }
        if (res.status === 429) {
            throw new Error('Spotify rate limit hit. Please wait before retrying.');
        }
        if (!res.ok) {
            throw new Error(`Spotify API error ${res.status}: ${await res.text()}`);
        }
        return res.json() as Promise<T>;
    }

}

export const spotifyService = new SpotifyService();
