/**
 * AppleMusicService — Apple Music for Artists Analytics Integration
 *
 * Uses MusicKit JS (browser SDK) for user authentication and Apple Music API access.
 * Analytics data (streams, Shazam, radio airplay, listener counts) requires an
 * Apple Music for Artists account — standard MusicKit developer tokens grant access
 * only to catalog and personal library, NOT to artist analytics.
 *
 * OAuth/Auth Flow:
 *   MusicKit JS handles Apple ID sign-in entirely client-side using the MusicKit
 *   developer token (a JWT signed with your Apple developer private key). No
 *   server-side token exchange is required for authentication.
 *
 * However, Apple Music for Artists analytics are served through a SEPARATE portal
 * (artists.apple.com) and its API is NOT publicly documented or available to
 * third-party developers. The data available via standard MusicKit:
 *   - User's library: songs, playlists, albums
 *   - Catalog: search, browse, recommendations
 *   - Storefront: country of the user
 *
 * What this service provides:
 *   - MusicKit JS initialization and Apple ID authentication
 *   - User's library tracks (to identify your releases in their library)
 *   - Catalog search to verify your tracks are on Apple Music
 *   - Placeholder for future Apple Music for Artists API when documented
 *
 * Setup requirements:
 *   1. Apple Developer account with MusicKit capability enabled
 *   2. Generate a MusicKit private key (.p8 file) in Apple Developer Console
 *   3. Create a developer token JWT (signed with private key, expires max 6 months)
 *      — this is typically done server-side and injected as VITE_APPLE_MUSIC_DEV_TOKEN
 *   4. MusicKit JS loaded from Apple's CDN in index.html:
 *      <script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"></script>
 *
 * Reference: https://developer.apple.com/documentation/musickitjs
 */

import { logger } from '@/utils/logger';
import type { PlatformData, StreamDataPoint } from './types';

// ── MusicKit JS type declarations ─────────────────────────────────────────────
// MusicKit is loaded via CDN — not an npm package

declare global {
    interface Window {
        MusicKit?: {
            configure(config: { developerToken: string; app: { name: string; build: string } }): Promise<MusicKitInstance>;
            getInstance(): MusicKitInstance;
        };
    }
}

interface MusicKitInstance {
    authorize(): Promise<string>;
    unauthorize(): Promise<void>;
    isAuthorized: boolean;
    storefrontCountryCode: string;
    musicUserToken: string;
    api: MusicKitAPI;
}

interface MusicKitAPI {
    library: {
        songs(params?: { limit?: number; offset?: number }): Promise<MusicKitLibrarySong[]>;
    };
    search(term: string, params?: { types?: string; limit?: number }): Promise<MusicKitSearchResults>;
}

interface MusicKitLibrarySong {
    id: string;
    attributes: {
        name: string;
        artistName: string;
        albumName: string;
        durationInMillis: number;
        artwork?: { url: string; width: number; height: number };
        releaseDate?: string;
        genreNames?: string[];
    };
}

interface MusicKitSearchResults {
    songs?: {
        data: {
            id: string;
            attributes: {
                name: string;
                artistName: string;
                albumName: string;
                durationInMillis: number;
                artwork?: { url: string };
                releaseDate?: string;
                url: string;
            };
        }[];
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// AppleMusicService
// ─────────────────────────────────────────────────────────────────────────────

export class AppleMusicService {
    private _kit: MusicKitInstance | null = null;

    // ── Initialization ────────────────────────────────────────────────────────

    /**
     * Initialize MusicKit JS with the developer token.
     * Call this before any other method.
     *
     * The developer token is a signed JWT. Never generate it client-side —
     * use a server endpoint or bake it in as an env var (it expires in ≤ 6 months).
     */
    async initialize(): Promise<void> {
        if (this._kit) return;

        const devToken = import.meta.env.VITE_APPLE_MUSIC_DEV_TOKEN;
        if (!devToken) {
            throw new Error(
                'VITE_APPLE_MUSIC_DEV_TOKEN is not set.\n' +
                'Generate a MusicKit developer token in the Apple Developer Console\n' +
                'and add it to your .env file.'
            );
        }

        if (!window.MusicKit) {
            throw new Error(
                'MusicKit JS is not loaded. Add the following to your index.html:\n' +
                '<script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"></script>'
            );
        }

        this._kit = await window.MusicKit.configure({
            developerToken: devToken,
            app: { name: 'indiiOS', build: '1.0.0' },
        });
    }

    // ── Auth / Connection ─────────────────────────────────────────────────────

    /**
     * Prompt the user to sign in with their Apple ID.
     * Opens Apple's native sign-in popup via MusicKit JS.
     */
    async connect(): Promise<void> {
        await this.initialize();
        if (!this._kit) throw new Error('MusicKit not initialized.');
        await this._kit.authorize();
    }

    /**
     * Sign out and revoke the MusicKit user token.
     */
    async disconnect(): Promise<void> {
        if (!this._kit) return;
        await this._kit.unauthorize();
        this._kit = null;
    }

    /**
     * Check if the user is currently signed in to Apple Music via MusicKit.
     */
    async isConnected(): Promise<boolean> {
        try {
            await this.initialize();
            return this._kit?.isAuthorized ?? false;
        } catch {
            return false;
        }
    }

    /**
     * Get the user's Apple Music storefront country code (e.g. "us", "gb").
     */
    getStorefront(): string {
        return this._kit?.storefrontCountryCode ?? 'us';
    }

    // ── Library access ────────────────────────────────────────────────────────

    /**
     * Get songs from the user's Apple Music library.
     * Useful for identifying which of your releases they have saved.
     */
    async getLibrarySongs(limit = 100): Promise<MusicKitLibrarySong[]> {
        if (!this._kit?.isAuthorized) throw new Error('Apple Music not connected.');
        return this._kit.api.library.songs({ limit });
    }

    /**
     * Search the Apple Music catalog for your tracks by artist name.
     * Returns the first page of matching results.
     */
    async searchCatalog(artistName: string, limit = 25): Promise<MusicKitSearchResults['songs']['data']> {
        if (!this._kit) throw new Error('MusicKit not initialized.');
        const results = await this._kit.api.search(artistName, { types: 'songs', limit });
        return results.songs?.data ?? [];
    }

    // ── Analytics placeholder ─────────────────────────────────────────────────

    /**
     * Build PlatformData for the analytics engine.
     *
     * NOTE: Apple Music for Artists analytics (streams, Shazam, radio airplay,
     * listener counts) are NOT available via the public MusicKit API. This method
     * returns a placeholder based on library presence counts.
     *
     * Full analytics require Apple Music for Artists partner access, which is not
     * publicly documented. Check artists.apple.com for updates.
     */
    async buildPlatformData(): Promise<PlatformData> {
        logger.warn(
            '[AppleMusicService] Apple Music for Artists analytics API is not publicly available. ' +
            'Returning estimated data based on library presence.'
        );

        const librarySongs = await this.getLibrarySongs(100);

        return {
            platform: 'apple_music',
            // We cannot get real stream counts without the Artists API.
            // Library song count is used as a very rough proxy.
            streams: librarySongs.length * 1000, // placeholder: each saved track ≈ 1k streams
            saves:   librarySongs.length,
            completionRate: 0.72, // Apple Music has high completion rates (curated platform)
            creatorCount: 0,
        };
    }

    /**
     * Build a 30-day stream history placeholder.
     * Real daily stream counts require Apple Music for Artists partner API.
     */
    buildStreamHistory(): StreamDataPoint[] {
        logger.warn('[AppleMusicService] Daily stream history requires Apple Music for Artists API (not publicly available).');

        const history: StreamDataPoint[] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            history.push({
                date:             d.toISOString().split('T')[0],
                streams:          0,
                saves:            0,
                completions:      0,
                uniqueListeners:  0,
                shares:           0,
                newFollowers:     0,
                playlistAdditions: 0,
            });
        }
        return history;
    }
}

export const appleMusicService = new AppleMusicService();
