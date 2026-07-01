/**
 * AppleMusicService — Apple Music for Artists Analytics Integration
 *
 * Apple Music analytics must be served by a backend integration.
 * Analytics data (streams, Shazam, radio airplay, listener counts) requires an
 * Apple Music for Artists account. Browser-side developer tokens are disabled.
 *
 * OAuth/Auth Flow:
 *   MusicKit JS requires a developer token signed with an Apple private key.
 *   That token must be minted and served by a secured backend route before this
 *   service can enable real Apple Music access.
 *
 * However, Apple Music for Artists analytics are served through a SEPARATE portal
 * (artists.apple.com) and its API is NOT publicly documented or available to
 * third-party developers. The data available via standard MusicKit:
 *   - User's library: songs, playlists, albums
 *   - Catalog: search, browse, recommendations
 *   - Storefront: country of the user
 *
 * What this service provides:
 *   - Fails closed for browser-side Apple Music access
 *   - Honest unavailable results until a secured Apple Music for Artists
 *     backend is configured
 *
 * Setup requirements:
 *   1. Apple Developer account with MusicKit capability enabled
 *   2. Generate a MusicKit private key (.p8 file) in Apple Developer Console
 *   3. Create a backend route that mints developer token JWTs with the private key
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
    static readonly UNAVAILABLE_MESSAGE =
        'Apple Music analytics require a secured Apple Music for Artists backend integration.';

    // ── Initialization ────────────────────────────────────────────────────────

    /**
     * Initialize MusicKit JS with the developer token.
     * Call this before any other method.
     *
     * The developer token is a signed JWT. Never generate or inject it client-side.
     */
    async initialize(): Promise<void> {
        if (this._kit) return;

        logger.warn('[AppleMusicService] Browser-side Apple Music developer tokens are disabled. Configure a secured Firebase/backend gateway.');
    }

    // ── Auth / Connection ─────────────────────────────────────────────────────

    /**
     * Prompt the user to sign in with their Apple ID.
     * Opens Apple's native sign-in popup via MusicKit JS when configured.
     */
    async connect(): Promise<void> {
        await this.initialize();
        if (!this._kit) {
            throw new Error(AppleMusicService.UNAVAILABLE_MESSAGE);
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
                return false;
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
            throw new Error(AppleMusicService.UNAVAILABLE_MESSAGE);
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
            throw new Error(AppleMusicService.UNAVAILABLE_MESSAGE);
        }
        const results = await this._kit.api.search(artistName, { types: 'songs', limit });
        return results.songs?.data ?? [];
    }

    // ── Partner Service Integration ───────────────────────────────────────────

    /**
     * Fetch analytics from the partner backend service for Apple Music for Artists.
     * Browser-side partner bearer tokens are disabled; this must route through
     * a secured Firebase/backend integration.
     */
    async fetchPartnerAnalytics(artistId: string): Promise<PlatformData | null> {
        void artistId;
        logger.warn('[AppleMusicService] Partner analytics are backend-only; no secured Firebase gateway is configured.');
        return null;
    }

    /**
     * Fetch daily stream history from the partner service.
     */
    async fetchPartnerStreamHistory(artistId: string): Promise<StreamDataPoint[] | null> {
        void artistId;
        logger.warn('[AppleMusicService] Partner stream history is backend-only; no secured Firebase gateway is configured.');
        return null;
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    /**
     * Build PlatformData for the analytics engine.
     * Returns null unless real partner analytics are available.
     */
    async buildPlatformData(artistId?: string): Promise<PlatformData | null> {
        await this.initialize();

        if (artistId) {
            const partnerData = await this.fetchPartnerAnalytics(artistId);
            if (partnerData) {
                logger.info('[AppleMusicService] Successfully loaded partner analytics data.');
                return partnerData;
            }
        }

        logger.warn('[AppleMusicService] Apple Music analytics unavailable: no secured partner analytics backend is configured.');
        return null;
    }

    /**
     * Build stream history from real partner data.
     */
    async buildStreamHistory(trackIdOrArtistId?: string): Promise<StreamDataPoint[] | null> {
        logger.info('[AppleMusicService] Building Apple Music stream history.');

        if (trackIdOrArtistId) {
            const partnerHistory = await this.fetchPartnerStreamHistory(trackIdOrArtistId);
            if (partnerHistory) {
                logger.info('[AppleMusicService] Loaded stream history from partner service.');
                return partnerHistory;
            }
        }

        logger.warn('[AppleMusicService] Apple Music stream history unavailable: no secured partner history backend is configured.');
        return null;
    }
}

export const appleMusicService = new AppleMusicService();
