import { openDB, IDBPDatabase } from 'idb';
import { logger } from '@/utils/logger';

/**
 * Requirement 163: Offline Music Player Mode
 * Caches audio blobs in IndexedDB to allow users to stream their
 * unreleased catalog locally even without internet.
 */

const DB_NAME = 'indiiOS-audio-cache';
const STORE_NAME = 'tracks';

export interface CachedTrack {
    id: string; // The Track ID from Firestore
    title: string;
    artist: string;
    audioBlob: Blob;
    cachedAt: number;
    mimeType: string;
}

export class OfflineStorageService {
    private dbPromise: Promise<IDBPDatabase>;

    constructor() {
        this.dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            },
        });
    }

    /**
     * Downloads an audio file from a remote URL and saves it locally in IndexedDB.
     */
    async downloadAndCacheTrack(trackId: string, url: string, metadata: { title: string, artist: string }): Promise<void> {
        try {
            logger.info(`[OfflineStorage] Downloading track ${trackId} for offline playback...`);

            const response = await fetch(url);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);

            const blob = await response.blob();
            const db = await this.dbPromise;

            const cachedTrack: CachedTrack = {
                id: trackId,
                title: metadata.title,
                artist: metadata.artist,
                audioBlob: blob,
                cachedAt: Date.now(),
                mimeType: blob.type || 'audio/mpeg'
            };

            await db.put(STORE_NAME, cachedTrack);
            logger.info(`[OfflineStorage] Successfully cached track ${trackId}.`);

        } catch (error) {
            logger.error(`[OfflineStorage] Failed to cache track ${trackId}:`, error);
            throw error;
        }
    }

    /**
     * Retrieves an object URL for a cached track to be passed directly to an <audio> element.
     */
    async getCachedTrackUrl(trackId: string): Promise<string | null> {
        try {
            const db = await this.dbPromise;
            const track = await db.get(STORE_NAME, trackId) as CachedTrack | undefined;

            if (track && track.audioBlob) {
                logger.info(`[OfflineStorage] Retrieved track ${trackId} from local cache.`);
                return URL.createObjectURL(track.audioBlob);
            }

            logger.info(`[OfflineStorage] Track ${trackId} not found in local cache.`);
            return null;
        } catch (error) {
            logger.error(`[OfflineStorage] Failed to retrieve cached track ${trackId}:`, error);
            return null;
        }
    }

    /**
     * Retrieves all locally cached tracks for an offline library view.
     */
    async getAllCachedTracks(): Promise<Omit<CachedTrack, 'audioBlob'>[]> {
        try {
            const db = await this.dbPromise;
            const allTracks = await db.getAll(STORE_NAME) as CachedTrack[];

            // Map out the heavy blob data for listing
            return allTracks.map(t => ({
                id: t.id,
                title: t.title,
                artist: t.artist,
                cachedAt: t.cachedAt,
                mimeType: t.mimeType
            }));
        } catch (error) {
            logger.error('[OfflineStorage] Failed to retrieve all cached tracks:', error);
            return [];
        }
    }

    /**
     * Removes a track from local offline storage to free up space.
     */
    async removeCachedTrack(trackId: string): Promise<void> {
        try {
            const db = await this.dbPromise;
            await db.delete(STORE_NAME, trackId);
            logger.info(`[OfflineStorage] Removed track ${trackId} from cache.`);
        } catch (error) {
            logger.error(`[OfflineStorage] Failed to remove track ${trackId}:`, error);
            throw error;
        }
    }
}

export const offlineStorageService = new OfflineStorageService();