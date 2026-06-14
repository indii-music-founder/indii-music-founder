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
import * as Sentry from '@sentry/react';
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
    private _sandboxConnected = false;

    // ── Initialization ────────────────────────────────────────────────────────

    /**
     * Initialize MusicKit JS with the developer token.
     * Call this before any other method.
     *
     * The developer token is a signed JWT. Never generate it client-side —
     * use a server endpoint or bake it in as an env var.
     */
    async initialize(): Promise<void> {
        if (this._kit) return;

        const devToken = import.meta.env.VITE_APPLE_MUSIC_DEV_TOKEN;
        if (!devToken) {
            logger.warn(
                '[AppleMusicService] VITE_APPLE_MUSIC_DEV_TOKEN is not set. ' +
                'Apple Music operations will run in fallback/sandbox mode.'
            );
            return;
        }

        if (!window.MusicKit) {
            logger.warn(
                '[AppleMusicService] MusicKit JS is not loaded. Add the CDN script to index.html. ' +
                'Apple Music operations will run in fallback/sandbox mode.'
            );
            return;
        }

        try {
            this._kit = await window.MusicKit.configure({
                developerToken: devToken,
                app: { name: 'indii', build: '1.0.0' },
            });
        } catch (err: unknown) {
            logger.error('[AppleMusicService] Failed to configure MusicKit:', err);
            Sentry.captureException(err);
        }
    }

    // ── Auth / Connection ─────────────────────────────────────────────────────

    /**
     * Prompt the user to sign in with their Apple ID.
     * Opens Apple's native sign-in popup via MusicKit JS, or connects sandbox.
     */
    async connect(): Promise<void> {
        await this.initialize();
        if (!this._kit) {
            logger.info('[AppleMusicService] MusicKit not initialized. Simulating connection in sandbox mode.');
            this._sandboxConnected = true;
            return;
        }
        try {
            await this._kit.authorize();
        } catch (err: unknown) {
            logger.error('[AppleMusicService] Connection failed:', err);
            Sentry.captureException(err);
            throw err;
        }
    }

    /**
     * Sign out and revoke the MusicKit user token.
     */
    async disconnect(): Promise<void> {
        this._sandboxConnected = false;
        if (!this._kit) return;
        try {
            await this._kit.unauthorize();
        } catch (err: unknown) {
            logger.error('[AppleMusicService] Error during disconnect:', err);
            Sentry.captureException(err);
        } finally {
            this._kit = null;
        }
    }

    /**
     * Check if the user is currently signed in to Apple Music.
     */
    async isConnected(): Promise<boolean> {
        try {
            await this.initialize();
            if (!this._kit) {
                return this._sandboxConnected;
            }
            return this._kit.isAuthorized;
        } catch (err: unknown) {
            logger.error('[AppleMusicService] Failed to check connection:', err);
            Sentry.captureException(err);
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
     */
    async getLibrarySongs(limit = 100): Promise<MusicKitLibrarySong[]> {
        await this.initialize();
        if (!this._kit) {
            logger.info('[AppleMusicService] Running in sandbox mode. Returning mock library songs.');
            return this.getMockLibrarySongs(limit);
        }
        if (!this._kit.isAuthorized) {
            throw new Error('Apple Music not connected.');
        }
        return this._kit.api.library.songs({ limit });
    }

    /**
     * Search the Apple Music catalog for your tracks by artist name.
     */
    async searchCatalog(artistName: string, limit = 25): Promise<NonNullable<MusicKitSearchResults['songs']>['data']> {
        await this.initialize();
        if (!this._kit) {
            logger.info('[AppleMusicService] Running in sandbox mode. Returning mock catalog search results.');
            return this.getMockCatalogSearch(artistName, limit);
        }
        const results = await this._kit.api.search(artistName, { types: 'songs', limit });
        return results.songs?.data ?? [];
    }

    // ── Partner Service Integration ───────────────────────────────────────────

    /**
     * Fetch analytics from the partner backend service for Apple Music for Artists.
     */
    async fetchPartnerAnalytics(artistId: string): Promise<PlatformData | null> {
        try {
            const backendUrl = import.meta.env.VITE_PARTNER_API_URL || 'https://api.indii.co/v1';
            const token = import.meta.env.VITE_PARTNER_API_TOKEN;

            if (!token) {
                logger.warn('[AppleMusicService] VITE_PARTNER_API_TOKEN not configured. Skipping partner analytics fetch.');
                return null;
            }

            logger.info(`[AppleMusicService] Fetching partner analytics for artist ${artistId} from ${backendUrl}`);
            const response = await fetch(`${backendUrl}/analytics/apple-music?artistId=${encodeURIComponent(artistId)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Partner service responded with status ${response.status}`);
            }

            const data = await response.json() as PlatformData;
            if (data && typeof data.streams === 'number') {
                return data;
            }
            return null;
        } catch (err: unknown) {
            logger.error('[AppleMusicService] Failed to fetch partner analytics:', err);
            Sentry.captureException(err);
            return null;
        }
    }

    /**
     * Fetch daily stream history from the partner service.
     */
    async fetchPartnerStreamHistory(artistId: string): Promise<StreamDataPoint[] | null> {
        try {
            const backendUrl = import.meta.env.VITE_PARTNER_API_URL || 'https://api.indii.co/v1';
            const token = import.meta.env.VITE_PARTNER_API_TOKEN;

            if (!token) return null;

            const response = await fetch(`${backendUrl}/analytics/apple-music/history?artistId=${encodeURIComponent(artistId)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) return null;

            return await response.json() as StreamDataPoint[];
        } catch (err: unknown) {
            logger.error('[AppleMusicService] Failed to fetch partner stream history:', err);
            return null;
        }
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    /**
     * Build PlatformData for the analytics engine.
     * Tries to fetch real analytics via partner service routes first. If they are
     * unavailable, falls back gracefully to library-based estimations or sandbox simulation.
     */
    async buildPlatformData(artistId?: string): Promise<PlatformData> {
        await this.initialize();

        // 1. Try partner service API first if artistId is present
        if (artistId) {
            const partnerData = await this.fetchPartnerAnalytics(artistId);
            if (partnerData) {
                logger.info('[AppleMusicService] Successfully loaded partner analytics data.');
                return partnerData;
            }
        }

        // 2. Fallback: Library song presence estimation
        logger.info(
            '[AppleMusicService] Apple Music for Artists direct API not available. ' +
            'Calculating estimate based on library presence.'
        );

        let librarySongs: MusicKitLibrarySong[] = [];
        try {
            librarySongs = await this.getLibrarySongs(100);
        } catch (err: unknown) {
            logger.warn('[AppleMusicService] Could not retrieve library songs. Returning default empty platform data structure.', err);
        }

        const savesCount = librarySongs.length;
        const estimatedStreams = savesCount > 0 ? savesCount * 1000 : 0;

        return {
            platform: 'apple_music',
            streams: estimatedStreams,
            saves: savesCount,
            completionRate: savesCount > 0 ? 0.72 : 0,
            creatorCount: 0,
        };
    }

    /**
     * Build a 30-day stream history.
     */
    async buildStreamHistory(trackIdOrArtistId?: string): Promise<StreamDataPoint[]> {
        logger.info('[AppleMusicService] Building Apple Music stream history.');

        if (trackIdOrArtistId) {
            const partnerHistory = await this.fetchPartnerStreamHistory(trackIdOrArtistId);
            if (partnerHistory) {
                logger.info('[AppleMusicService] Loaded stream history from partner service.');
                return partnerHistory;
            }
        }

        const history: StreamDataPoint[] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            history.push({
                date:             d.toISOString().split('T')[0]!,
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

    // ── Sandbox Mock Generators ───────────────────────────────────────────────

    private getMockLibrarySongs(limit: number): MusicKitLibrarySong[] {
        const mockSongs: MusicKitLibrarySong[] = [
            {
                id: 'mock-am-1',
                attributes: {
                    name: 'Starlight Dreamer',
                    artistName: 'indii founder',
                    albumName: 'Neon Horizons',
                    durationInMillis: 215000,
                    artwork: { url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&h=120&fit=crop', width: 120, height: 120 },
                    releaseDate: '2026-01-15',
                    genreNames: ['Electronic', 'Synthwave']
                }
            },
            {
                id: 'mock-am-2',
                attributes: {
                    name: 'Midnight Pulse',
                    artistName: 'indii founder',
                    albumName: 'Neon Horizons',
                    durationInMillis: 198000,
                    artwork: { url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=120&h=120&fit=crop', width: 120, height: 120 },
                    releaseDate: '2026-02-10',
                    genreNames: ['Electronic', 'Dance']
                }
            }
        ];
        return mockSongs.slice(0, limit);
    }

    private getMockCatalogSearch(term: string, limit: number): NonNullable<MusicKitSearchResults['songs']>['data'] {
        const mockCatalog = [
            {
                id: 'catalog-am-1',
                attributes: {
                    name: 'Starlight Dreamer',
                    artistName: term,
                    albumName: 'Neon Horizons',
                    durationInMillis: 215000,
                    artwork: { url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&h=120&fit=crop' },
                    releaseDate: '2026-01-15',
                    url: 'https://music.apple.com/us/album/neon-horizons/mock-album-1'
                }
            },
            {
                id: 'catalog-am-2',
                attributes: {
                    name: 'Midnight Pulse',
                    artistName: term,
                    albumName: 'Neon Horizons',
                    durationInMillis: 198000,
                    artwork: { url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=120&h=120&fit=crop' },
                    releaseDate: '2026-02-10',
                    url: 'https://music.apple.com/us/album/neon-horizons/mock-album-2'
                }
            }
        ];
        return mockCatalog.slice(0, limit);
    }
}

export const appleMusicService = new AppleMusicService();
