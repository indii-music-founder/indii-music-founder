/**
 * MetadataPersistenceService - Centralized service for reliable metadata persistence
 * 
 * This service provides:
 * - Consistent error handling with user-visible feedback (toasts)
 * - Automatic retry logic for transient failures
 * - Queue-based persistence for offline resilience
 * - Authentication state awareness
 * 
 * ALL asset metadata (audio, image, video, documents) should flow through this service
 * to ensure data is never silently lost.
 */

import { db, auth } from '@/services/firebase';
import { collection, addDoc, setDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { events } from '@/core/events';

// Types for different asset metadata
export type AssetType = 'audio' | 'image' | 'video' | 'document' | 'workflow' | 'project' | 'campaign';

export interface PersistenceResult {
    success: boolean;
    docId?: string;
    error?: string;
    retryable: boolean;
}

export interface PersistenceOptions {
    /** Show toast notifications for errors (default: true) */
    showToasts?: boolean;
    /** Number of retry attempts (default: 2) */
    maxRetries?: number;
    /** Delay between retries in ms (default: 1000) */
    retryDelay?: number;
    /** Queue for offline save if immediate save fails (default: true) */
    queueOnFailure?: boolean;
    /** Custom collection path (overrides default based on assetType) */
    customCollection?: string;
}

interface QueuedSave {
    assetType: AssetType;
    data: Record<string, unknown>;
    collectionPath: string;
    timestamp: number;
    retryCount: number;
}

const QUEUE_KEY = 'indiiOS_pendingMetadataSaves';

/**
 * MetadataPersistenceService - Centralized service for reliable metadata persistence
 * 
 * Provides consistent error handling, automatic retry logic, and queue-based 
 * offline resilience for all asset metadata.
 */
class MetadataPersistenceService {
    private isProcessingQueue = false;

    /**
     * Get the default collection path for an asset type
     */
    private getCollectionPath(assetType: AssetType, userId: string): string {
        switch (assetType) {
            case 'audio':
                return `users/${userId}/analyzed_tracks`;
            case 'image':
                return `users/${userId}/generated_images`;
            case 'video':
                return `users/${userId}/generated_videos`;
            case 'document':
                return `users/${userId}/knowledge_base`;
            case 'workflow':
                return `users/${userId}/workflows`;
            case 'project':
                return `users/${userId}/projects`;
            case 'campaign':
                return 'campaigns';
            default:
                return `users/${userId}/assets`;
        }
    }

    /**
     * Check if user is authenticated
     */
    private checkAuth(): { authenticated: boolean; userId?: string } {
        const user = auth.currentUser;
        if (!user) {
            return { authenticated: false };
        }
        return { authenticated: true, userId: user.uid };
    }

    /**
     * Save to the offline queue for later sync
     */
    private queueForLater(item: QueuedSave): void {
        try {
            const existing = localStorage.getItem(QUEUE_KEY);
            const queue: QueuedSave[] = existing ? JSON.parse(existing) : [];
            queue.push(item);
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            console.info(`[MetadataPersistence] Queued ${item.assetType} for later sync (${queue.length} items pending)`);
        } catch (e) {
            console.error('[MetadataPersistence] Failed to queue for later:', e);
        }
    }

    /**
     * Process the offline queue when connection is restored
     */
    async processQueue(): Promise<number> {
        if (this.isProcessingQueue) return 0;
        this.isProcessingQueue = true;

        try {
            const existing = localStorage.getItem(QUEUE_KEY);
            if (!existing) return 0;

            const queue: QueuedSave[] = JSON.parse(existing);
            if (queue.length === 0) return 0;

            const { authenticated, userId } = this.checkAuth();
            if (!authenticated || !userId) {
                console.warn('[MetadataPersistence] Cannot process queue - not authenticated');
                return 0;
            }

            let successCount = 0;
            const failedItems: QueuedSave[] = [];

            for (const item of queue) {
                try {
                    await addDoc(collection(db, item.collectionPath), {
                        ...item.data,
                        syncedAt: serverTimestamp(),
                        originalTimestamp: Timestamp.fromMillis(item.timestamp),
                    });
                    successCount++;
                } catch (e) {
                    console.error(`[MetadataPersistence] Failed to sync queued item:`, e);
                    if (item.retryCount < 3) {
                        failedItems.push({ ...item, retryCount: item.retryCount + 1 });
                    }
                }
            }

            // Save failed items back to queue
            if (failedItems.length > 0) {
                localStorage.setItem(QUEUE_KEY, JSON.stringify(failedItems));
            } else {
                localStorage.removeItem(QUEUE_KEY);
            }

            if (successCount > 0) {
                events.emit('SYSTEM_ALERT', { level: 'success', message: `✅ Synced ${successCount} pending item(s) to cloud` });
            }

            return successCount;
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Main save method with retry logic and error handling
     */
    /**
     * Main save method with retry logic and error handling.
     * Enriches data with metadata and handles authentication checks.
     * 
     * @param assetType - The type of asset (audio, video, etc)
     * @param data - The metadata payload to persist
     * @param options - Persistence configuration (retries, toasts, etc)
     */
    async save(
        assetType: AssetType,
        data: Record<string, unknown>,
        options: PersistenceOptions = {}
    ): Promise<PersistenceResult> {
        const {
            showToasts = true,
            maxRetries = 2,
            retryDelay = 1000,
            queueOnFailure = true,
            customCollection,
        } = options;

        // 1. Check Authentication
        const { authenticated, userId } = this.checkAuth();
        if (!authenticated || !userId) {
            const errorMsg = 'You must be logged in to save data. Please sign in and try again.';
            if (showToasts) {
                events.emit('SYSTEM_ALERT', { level: 'error', message: `❌ Save Failed: ${errorMsg}` });
            }
            console.warn(`[MetadataPersistence] Cannot save ${assetType}: Not authenticated`);

            // Queue for later if enabled
            if (queueOnFailure) {
                const collectionPath = customCollection || this.getCollectionPath(assetType, 'pending');
                this.queueForLater({
                    assetType,
                    data: { ...data, pendingUserId: 'unknown' },
                    collectionPath,
                    timestamp: Date.now(),
                    retryCount: 0,
                });
                if (showToasts) {
                    events.emit('SYSTEM_ALERT', { level: 'info', message: '📥 Saved locally - will sync when you sign in' });
                }
            }

            return {
                success: false,
                error: errorMsg,
                retryable: true,
            };
        }

        // 2. Prepare data with metadata
        const collectionPath = customCollection || this.getCollectionPath(assetType, userId);
        const enrichedData = {
            ...data,
            userId,
            assetType,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        // 3. Attempt save with retries
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const docRef = await addDoc(collection(db, collectionPath), enrichedData);
                console.info(`[MetadataPersistence] ✅ Saved ${assetType} to ${collectionPath}/${docRef.id}`);

                if (showToasts && attempt > 0) {
                    events.emit('SYSTEM_ALERT', { level: 'success', message: '✅ Saved successfully (after retry)' });
                }

                return {
                    success: true,
                    docId: docRef.id,
                    retryable: false,
                };
            } catch (error) {
                lastError = error as Error;
                console.warn(`[MetadataPersistence] Save attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);

                if (attempt < maxRetries) {
                    // Wait before retry with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
                }
            }
        }

        // 4. All retries failed
        const errorMessage = lastError?.message || 'Unknown error occurred';
        const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED');
        const isNetworkError = errorMessage.includes('network') || errorMessage.includes('offline');
        const isPermissionError = errorMessage.includes('PERMISSION_DENIED');

        // Determine appropriate user message
        let userMessage = 'Failed to save data.';
        if (isQuotaError) {
            userMessage = 'Storage quota exceeded. Please upgrade your plan or free up space.';
        } else if (isNetworkError) {
            userMessage = 'Network error. Your data has been saved locally and will sync when connection is restored.';
        } else if (isPermissionError) {
            userMessage = 'Permission denied. Please check your account settings.';
        }

        if (showToasts) {
            events.emit('SYSTEM_ALERT', { level: 'error', message: `❌ ${userMessage}` });
        }

        // Queue for later sync if it's a transient error
        if (queueOnFailure && (isNetworkError || !isPermissionError)) {
            this.queueForLater({
                assetType,
                data: enrichedData,
                collectionPath,
                timestamp: Date.now(),
                retryCount: 0,
            });
        }

        return {
            success: false,
            error: errorMessage,
            retryable: isNetworkError || isQuotaError,
        };
    }

    /**
     * Update existing document
     */
    async update(
        collectionPath: string,
        docId: string,
        data: Record<string, unknown>,
        options: Pick<PersistenceOptions, 'showToasts' | 'maxRetries'> = {}
    ): Promise<PersistenceResult> {
        const { showToasts = true, maxRetries = 2 } = options;

        const { authenticated } = this.checkAuth();
        if (!authenticated) {
            if (showToasts) {
                events.emit('SYSTEM_ALERT', { level: 'error', message: '❌ You must be logged in to update data.' });
            }
            return { success: false, error: 'Not authenticated', retryable: true };
        }

        const enrichedData = {
            ...data,
            updatedAt: serverTimestamp(),
        };

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await setDoc(doc(db, collectionPath, docId), enrichedData, { merge: true });
                console.info(`[MetadataPersistence] ✅ Updated ${collectionPath}/${docId}`);
                return { success: true, docId, retryable: false };
            } catch (error) {
                console.warn(`[MetadataPersistence] Update attempt ${attempt + 1} failed:`, error);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                }
            }
        }

        if (showToasts) {
            events.emit('SYSTEM_ALERT', { level: 'error', message: '❌ Failed to update data. Please try again.' });
        }
        return { success: false, error: 'Update failed after retries', retryable: true };
    }

    /**
     * Get pending queue count
     */
    getPendingCount(): number {
        try {
            const existing = localStorage.getItem(QUEUE_KEY);
            if (!existing) return 0;
            return JSON.parse(existing).length;
        } catch {
            return 0;
        }
    }

    /**
     * Retry a failed save with user interaction
     */
    async retrySave(
        assetType: AssetType,
        data: Record<string, unknown>,
        customCollection?: string
    ): Promise<PersistenceResult> {
        events.emit('SYSTEM_ALERT', { level: 'info', message: 'Retrying save...' });
        const result = await this.save(assetType, data, {
            showToasts: false, // We handle completion toasts here
            maxRetries: 3,
            retryDelay: 500,
            customCollection,
        });

        if (result.success) {
            events.emit('SYSTEM_ALERT', { level: 'success', message: '✅ Saved successfully!' });
        } else {
            events.emit('SYSTEM_ALERT', { level: 'error', message: `❌ Save failed: ${result.error}` });
        }

        return result;
    }
}

export const metadataPersistenceService = new MetadataPersistenceService();

// Auto-process queue when user becomes authenticated
if (typeof window !== 'undefined' && auth?.onAuthStateChanged) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User just signed in, try to sync pending items
            setTimeout(() => {
                metadataPersistenceService.processQueue();
            }, 2000);
        }
    });
}

