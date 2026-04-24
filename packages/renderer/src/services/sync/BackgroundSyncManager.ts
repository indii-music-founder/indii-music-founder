import { logger } from '@/utils/logger';
import { OfflineFirstService, SyncItem } from './OfflineFirstService';

interface SyncResult {
  id: string;
  success: boolean;
  error?: string;
}

interface SyncOperation {
  collection: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  id?: string;
}

type SyncQueueChangeCallback = (queue: SyncItem[]) => void;

/**
 * BackgroundSyncManager
 *
 * Orchestrates Service Worker background sync with Zustand store updates.
 * Manages queue persistence, sync coordination, and conflict detection.
 */
export class BackgroundSyncManager {
  private offlineService: OfflineFirstService;
  private syncQueueListeners: Set<SyncQueueChangeCallback> = new Set();
  private isSyncing = false;

  constructor(offlineService: OfflineFirstService) {
    this.offlineService = offlineService;
    this.initializeSyncHandlers();
  }

  private initializeSyncHandlers(): void {
    // Listen for online events and trigger sync
    window.addEventListener('online', () => {
      logger.info('BackgroundSyncManager: device online, triggering sync');
      this.syncAll().catch((error) => {
        logger.error('BackgroundSyncManager: sync failed after coming online', error);
      });
    });

    // Listen for offlineSync events from OfflineFirstService
    window.addEventListener('offlineSync', ((event: CustomEvent) => {
      const item = event.detail as SyncItem;
      this.notifyQueueChange();
      logger.debug(`BackgroundSyncManager: sync event for ${item.id}`);
    }) as EventListener);
  }

  /**
   * Queue a mutation for offline-first execution
   */
  async queueMutation(mutation: SyncOperation): Promise<string> {
    const itemId = await this.offlineService.queueOperation(
      mutation.collection,
      mutation.operation,
      mutation.data,
      mutation.id
    );
    this.notifyQueueChange();
    return itemId;
  }

  /**
   * Sync all pending operations
   */
  async syncAll(): Promise<SyncResult[]> {
    if (this.isSyncing) {
      logger.warn('BackgroundSyncManager: sync already in progress');
      return [];
    }

    this.isSyncing = true;
    const results: SyncResult[] = [];

    try {
      await this.offlineService.syncPending();
      // OfflineFirstService handles individual sync results
      // We just mark success if no exception thrown
      results.push({
        id: 'batch-sync',
        success: true,
      });
    } catch (error) {
      logger.error('BackgroundSyncManager: batch sync failed', error);
      results.push({
        id: 'batch-sync',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isSyncing = false;
      this.notifyQueueChange();
    }

    return results;
  }

  /**
   * Get current sync queue
   */
  getQueue(): SyncItem[] {
    return Array.from(this.offlineService['syncQueue']?.values?.() ?? []);
  }

  /**
   * Retry a specific queued operation
   */
  async retryItem(id: string): Promise<void> {
    const queue = this.getQueue();
    const item = queue.find((i) => i.id === id);

    if (!item) {
      logger.warn(`BackgroundSyncManager: item ${id} not found in queue`);
      return;
    }

    // Reset retry count and sync
    item.retries = 0;
    await this.offlineService.syncPending();
    this.notifyQueueChange();
  }

  /**
   * Clear a specific item from queue
   */
  async clearItem(id: string): Promise<void> {
    const queue = this.getQueue();
    const item = queue.find((i) => i.id === id);

    if (!item) {
      logger.warn(`BackgroundSyncManager: item ${id} not found in queue`);
      return;
    }

    // Remove from queue
    this.offlineService['syncQueue']?.delete(id);

    // Remove from IndexedDB
    if (this.offlineService['db']) {
      const tx = this.offlineService['db'].transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      await new Promise<void>((resolve) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
      });
    }

    this.notifyQueueChange();
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      queueLength: this.getQueue().length,
      isOnline: navigator.onLine,
    };
  }

  /**
   * Subscribe to queue changes
   */
  onSyncQueueChange(callback: SyncQueueChangeCallback): () => void {
    this.syncQueueListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.syncQueueListeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyQueueChange(): void {
    const queue = this.getQueue();
    this.syncQueueListeners.forEach((callback) => {
      callback(queue);
    });
  }
}

// Singleton instance
let backgroundSyncManager: BackgroundSyncManager | null = null;

export function initializeBackgroundSyncManager(
  offlineService: OfflineFirstService
): BackgroundSyncManager {
  if (!backgroundSyncManager) {
    backgroundSyncManager = new BackgroundSyncManager(offlineService);
  }
  return backgroundSyncManager;
}

export function getBackgroundSyncManager(): BackgroundSyncManager {
  if (!backgroundSyncManager) {
    throw new Error(
      'BackgroundSyncManager not initialized. Call initializeBackgroundSyncManager first.'
    );
  }
  return backgroundSyncManager;
}
