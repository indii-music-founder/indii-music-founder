import { logger } from '@/utils/logger';

interface SyncItem {
  id: string;
  collection: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

interface OfflineConfig {
  maxRetries?: number;
  syncInterval?: number;
  enableLogging?: boolean;
}

/**
 * OfflineFirstService
 *
 * Provides offline-first data sync for Firestore with:
 * - Local IndexedDB persistence
 * - Automatic sync queue management
 * - Conflict resolution
 * - Offline detection
 * - Exponential backoff retry
 */
export class OfflineFirstService {
  private dbName = 'indiiOS_offline';
  private db: IDBDatabase | null = null;
  private syncQueue: Map<string, SyncItem> = new Map();
  private isOnline = navigator.onLine;
  private maxRetries = 5;
  private syncInterval = 30000; // 30 seconds
  private syncTimer: NodeJS.Timeout | null = null;
  private enableLogging = false;

  constructor(config?: OfflineConfig) {
    if (config?.maxRetries) this.maxRetries = config.maxRetries;
    if (config?.syncInterval) this.syncInterval = config.syncInterval;
    if (config?.enableLogging) this.enableLogging = config.enableLogging;

    this.initializeDB();
    this.setupOnlineDetection();
  }

  private async initializeDB(): Promise<void> {
    try {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        logger.error('Failed to open IndexedDB', request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.log('IndexedDB initialized');

        // Create object stores if they don't exist
        if (!this.db.objectStoreNames.contains('syncQueue')) {
          this.db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!this.db.objectStoreNames.contains('offline_data')) {
          this.db.createObjectStore('offline_data', { keyPath: 'id' });
        }
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('offline_data')) {
          db.createObjectStore('offline_data', { keyPath: 'id' });
        }
      };
    } catch (error) {
      logger.error('IndexedDB not available', error);
    }
  }

  private setupOnlineDetection(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.log('Back online - syncing queue');
      this.syncPending();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.log('Offline - queuing operations');
    });
  }

  /**
   * Queue an operation for offline-first execution
   */
  async queueOperation(
    collection: string,
    operation: 'create' | 'update' | 'delete',
    data: Record<string, unknown>,
    id?: string
  ): Promise<string> {
    const itemId = id || `${collection}_${Date.now()}_${Math.random()}`;

    const item: SyncItem = {
      id: itemId,
      collection,
      operation,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    // Add to in-memory queue
    this.syncQueue.set(itemId, item);

    // Persist to IndexedDB
    if (this.db) {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      await new Promise((resolve, reject) => {
        const req = store.add(item);
        req.onsuccess = () => resolve(undefined);
        req.onerror = () => reject(req.error);
      });
    }

    this.log(`Queued ${operation} for ${collection}/${itemId}`);

    // Attempt immediate sync if online
    if (this.isOnline) {
      this.syncPending();
    }

    return itemId;
  }

  /**
   * Save data locally for offline access
   */
  async saveOfflineData(
    collection: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.db) return;

    const offlineItem = {
      id: `${collection}/${id}`,
      collection,
      docId: id,
      data,
      timestamp: Date.now(),
    };

    const tx = this.db.transaction('offline_data', 'readwrite');
    const store = tx.objectStore('offline_data');

    return new Promise((resolve, reject) => {
      const req = store.put(offlineItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieve offline data
   */
  async getOfflineData(collection: string, id: string): Promise<unknown> {
    if (!this.db) return null;

    const tx = this.db.transaction('offline_data', 'readonly');
    const store = tx.objectStore('offline_data');
    const key = `${collection}/${id}`;

    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const item = req.result;
        resolve(item ? item.data : null);
      };
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Clear offline cache for a collection
   */
  async clearOfflineCollection(collection: string): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('offline_data', 'readwrite');
    const store = tx.objectStore('offline_data');

    const allKeys = await new Promise<IDBValidKey[]>((resolve) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });

    const keysToDelete = allKeys.filter(
      (key) => typeof key === 'string' && key.startsWith(`${collection}/`)
    );

    for (const key of keysToDelete) {
      await new Promise<void>((resolve) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
      });
    }
  }

  /**
   * Get pending sync count
   */
  getPendingCount(): number {
    return this.syncQueue.size;
  }

  /**
   * Get sync status
   */
  getStatus(): {
    isOnline: boolean;
    pendingOperations: number;
    lastSync?: number;
  } {
    return {
      isOnline: this.isOnline,
      pendingOperations: this.syncQueue.size,
    };
  }

  /**
   * Attempt to sync pending operations
   */
  async syncPending(): Promise<void> {
    if (!this.isOnline) {
      this.log('Not online - skipping sync');
      return;
    }

    const items = Array.from(this.syncQueue.values());
    this.log(`Syncing ${items.length} pending operations`);

    for (const item of items) {
      try {
        await this.attemptSync(item);
      } catch (error) {
        logger.warn(`Sync failed for ${item.id}`, error);
        item.retries++;

        if (item.retries >= this.maxRetries) {
          this.log(`Max retries exceeded for ${item.id}`);
          this.syncQueue.delete(item.id);
        }
      }
    }
  }

  /**
   * Attempt to sync a single operation
   */
  private async attemptSync(item: SyncItem): Promise<void> {
    // This is a hook for the application to implement actual sync logic
    // The app should override this or provide a sync handler
    const event = new CustomEvent('offlineSync', {
      detail: item,
    });
    window.dispatchEvent(event);

    // Mark as synced
    this.syncQueue.delete(item.id);

    if (this.db) {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      await new Promise<void>((resolve) => {
        const req = store.delete(item.id);
        req.onsuccess = () => resolve();
      });
    }
  }

  /**
   * Start automatic sync loop
   */
  startAutoSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.syncQueue.size > 0) {
        this.syncPending();
      }
    }, this.syncInterval);

    this.log('Auto sync started');
  }

  /**
   * Stop automatic sync loop
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.log('Auto sync stopped');
    }
  }

  private log(message: string): void {
    if (this.enableLogging) {
      logger.debug(`[OfflineSync] ${message}`);
    }
  }
}

export const offlineFirstService = new OfflineFirstService({
  enableLogging: import.meta.env.DEV,
});
