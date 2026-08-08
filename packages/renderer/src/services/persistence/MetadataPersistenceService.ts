/**
 * MetadataPersistenceService - Centralized service for metadata persistence
 * 
 * This service provides:
 * - Consistent error handling with user-visible feedback (toasts)
 * - Automatic retry logic for transient failures
 * - Authentication state awareness
 * 
 * ALL asset metadata (audio, image, video, documents) should flow through this service
 * to ensure failures are reported consistently and never presented as successful saves.
 */

import { auth, db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { events } from '@/core/events';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

export type AssetType = 'audio' | 'image';

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
}

/**
 * MetadataPersistenceService - Centralized service for reliable metadata persistence
 * 
 * Provides consistent error handling and automatic retry logic for asset metadata.
 */
class MetadataPersistenceService {
    /**
     * Get the default collection path for an asset type
     */
    private getCollectionPath(assetType: AssetType, userId: string): string {
        return assetType === 'audio'
            ? `users/${userId}/analyzed_tracks`
            : `users/${userId}/generated_images`;
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
        } = options;

        // 1. Check Authentication
        const { authenticated, userId } = this.checkAuth();
        if (!authenticated || !userId) {
            const errorMsg = 'You must be logged in to save data. Please sign in and try again.';
            if (showToasts) {
                events.emit('SYSTEM_ALERT', { level: 'error', message: `❌ Save Failed: ${errorMsg}` });
            }
            logger.warn(`[MetadataPersistence] Cannot save ${assetType}: Not authenticated`);

            return {
                success: false,
                error: errorMsg,
                retryable: true,
            };
        }

        // 2. Prepare data with metadata
        const collectionPath = this.getCollectionPath(assetType, userId);
        const enrichedData = {
            ...data,
            userId,
            assetType,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        // E2E Mock: Bypass Firebase
        if (isFirebaseE2EMockEnabled()) {
            logger.info(`[MetadataPersistence] 🧪 E2E Mock: Bypassing Firestore save for ${assetType} to ${collectionPath}`);
            const mockDocId = `mock-${Date.now()}`;
            try {
               const mockKey = `E2E_MOCK_METADATA_${userId}_${mockDocId}`;
               localStorage.setItem(mockKey, JSON.stringify(enrichedData));
            } catch (_e) { /* ignore */ }

            if (showToasts) {
                events.emit('SYSTEM_ALERT', { level: 'success', message: '✅ Saved successfully (E2E Mock)' });
            }
            return { success: true, docId: mockDocId, retryable: false };
        }

        // 3. Attempt save with retries
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const docRef = await addDoc(collection(db, collectionPath), enrichedData);
                logger.info(`[MetadataPersistence] ✅ Saved ${assetType} to ${collectionPath}/${docRef.id}`);

                if (showToasts && attempt > 0) {
                    events.emit('SYSTEM_ALERT', { level: 'success', message: '✅ Saved successfully (after retry)' });
                }

                return {
                    success: true,
                    docId: docRef.id,
                    retryable: false,
                };
            } catch (error: unknown) {
                lastError = error as Error;
                logger.warn(`[MetadataPersistence] Save attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);

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
            userMessage = 'Network error. Save failed after retries. Check your connection and try again.';
        } else if (isPermissionError) {
            userMessage = 'Permission denied. Please check your account settings.';
        }

        if (showToasts) {
            events.emit('SYSTEM_ALERT', { level: 'error', message: `❌ ${userMessage}` });
        }

        return {
            success: false,
            error: errorMessage,
            retryable: isNetworkError || isQuotaError,
        };
    }

}

export const metadataPersistenceService = new MetadataPersistenceService();
