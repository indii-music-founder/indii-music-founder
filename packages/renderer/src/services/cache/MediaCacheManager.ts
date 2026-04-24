import { logger } from '@/utils/logger';

interface CachedMedia {
  url: string;
  blob: Blob;
  mediaType: 'image' | 'video' | 'audio';
  timestamp: number;
  size: number;
}

interface StorageStats {
  used: number;
  total: number;
  percentage: number;
}

const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB (safe limit for most browsers)
const DB_NAME = 'indiiOS_media_cache';
const STORE_NAME = 'media';

/**
 * MediaCacheManager
 *
 * Lazy-loads media into IndexedDB with LRU (Least Recently Used) eviction.
 * Implements size tracking and automatic cleanup when quota exceeded.
 */
export class MediaCacheManager {
  private db: IDBDatabase | null = null;
  private totalSize = 0;

  async initialize(): Promise<void> {
    try {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => {
        logger.error('MediaCacheManager: Failed to open IndexedDB', request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info('MediaCacheManager: IndexedDB initialized');
        this.calculateTotalSize().catch((error) => {
          logger.error('MediaCacheManager: Failed to calculate total size', error);
        });
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    } catch (error) {
      logger.error('MediaCacheManager: IndexedDB not available', error);
    }
  }

  /**
   * Cache media from URL
   */
  async cacheMedia(
    url: string,
    mediaType: 'image' | 'video' | 'audio'
  ): Promise<Blob> {
    // Try to get from cache first
    const cached = await this.getCached(url);
    if (cached) {
      return cached;
    }

    try {
      // Fetch media
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const size = blob.size;

      // Check if adding this would exceed quota
      if (this.totalSize + size > MAX_CACHE_SIZE) {
        // Evict oldest items until we have space
        await this.evictUntilHasSpace(size);
      }

      // Store in IndexedDB
      if (this.db) {
        const cached: CachedMedia = {
          url,
          blob,
          mediaType,
          timestamp: Date.now(),
          size,
        };

        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(cached);
          req.onsuccess = () => {
            this.totalSize += size;
            logger.debug(
              `MediaCacheManager: cached ${url} (${(size / 1024).toFixed(2)}KB)`
            );
            resolve();
          };
          req.onerror = () => reject(req.error);
        });
      }

      return blob;
    } catch (error) {
      logger.error(`MediaCacheManager: Failed to cache ${url}`, error);
      throw error;
    }
  }

  /**
   * Get cached media blob
   */
  async getCached(url: string): Promise<Blob | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);

      req.onsuccess = () => {
        const item = req.result as CachedMedia | undefined;
        if (item) {
          logger.debug(`MediaCacheManager: cache hit for ${url}`);
          resolve(item.blob);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        logger.warn(`MediaCacheManager: Failed to get cached ${url}`);
        resolve(null);
      };
    });
  }

  /**
   * Evict oldest items until target space available
   */
  private async evictUntilHasSpace(requiredSize: number): Promise<void> {
    if (!this.db) return;

    logger.info(
      `MediaCacheManager: evicting oldest items (need ${(requiredSize / 1024).toFixed(2)}KB)`
    );

    let remainingSpace = MAX_CACHE_SIZE - this.totalSize;
    while (remainingSpace < requiredSize) {
      const evicted = await this.evictOldest();
      if (!evicted) break; // No more items to evict
      remainingSpace = MAX_CACHE_SIZE - this.totalSize;
    }
  }

  /**
   * Evict single oldest item by timestamp
   */
  private async evictOldest(): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');

      // Get oldest (first) item
      const req = index.openCursor();
      let evicted = false;

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const item = cursor.value as CachedMedia;
          logger.debug(
            `MediaCacheManager: evicting ${item.url} (${(item.size / 1024).toFixed(2)}KB)`
          );

          const deleteReq = cursor.delete();
          deleteReq.onsuccess = () => {
            this.totalSize -= item.size;
            evicted = true;
            resolve(true);
          };
        } else {
          resolve(false); // No items to evict
        }
      };

      req.onerror = () => {
        logger.warn('MediaCacheManager: Failed to evict oldest');
        resolve(false);
      };
    });
  }

  /**
   * Calculate total cache size
   */
  private async calculateTotalSize(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result as CachedMedia[];
        this.totalSize = items.reduce((sum, item) => sum + item.size, 0);
        logger.info(
          `MediaCacheManager: total cache size = ${(this.totalSize / 1024 / 1024).toFixed(2)}MB`
        );
        resolve();
      };

      req.onerror = () => {
        logger.warn('MediaCacheManager: Failed to calculate total size');
        resolve();
      };
    });
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): StorageStats {
    return {
      used: this.totalSize,
      total: MAX_CACHE_SIZE,
      percentage: (this.totalSize / MAX_CACHE_SIZE) * 100,
    };
  }

  /**
   * Clear entire cache
   */
  async clearCache(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => {
        this.totalSize = 0;
        logger.info('MediaCacheManager: cache cleared');
        resolve();
      };

      req.onerror = () => {
        logger.warn('MediaCacheManager: Failed to clear cache');
        resolve();
      };
    });
  }

  /**
   * Clear cache for specific media type
   */
  async clearMediaType(
    mediaType: 'image' | 'video' | 'audio'
  ): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const item = cursor.value as CachedMedia;
          if (item.mediaType === mediaType) {
            this.totalSize -= item.size;
            cursor.delete();
          }
          cursor.continue();
        } else {
          logger.info(`MediaCacheManager: cleared ${mediaType} cache`);
          resolve();
        }
      };

      req.onerror = () => {
        logger.warn(`MediaCacheManager: Failed to clear ${mediaType} cache`);
        resolve();
      };
    });
  }
}

// Singleton instance
let mediaCacheManager: MediaCacheManager | null = null;

export async function initializeMediaCacheManager(): Promise<
  MediaCacheManager
> {
  if (!mediaCacheManager) {
    mediaCacheManager = new MediaCacheManager();
    await mediaCacheManager.initialize();
  }
  return mediaCacheManager;
}

export function getMediaCacheManager(): MediaCacheManager {
  if (!mediaCacheManager) {
    throw new Error(
      'MediaCacheManager not initialized. Call initializeMediaCacheManager first.'
    );
  }
  return mediaCacheManager;
}
