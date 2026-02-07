
import { db, storage } from './firebase';
import { collection, query, orderBy, limit, Timestamp, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { HistoryItem } from '@/core/types/history';
import { OrganizationService } from './OrganizationService';
import { FirestoreService } from './FirestoreService';
import { CloudStorageService } from './CloudStorageService';
import { Logger } from '@/core/logger/Logger';
import { events } from '@/core/events';

interface HistoryDocument extends Omit<HistoryItem, 'timestamp'> {
    timestamp: Timestamp;
    userId: string | null;
    orgId: string;
    updatedAt?: Timestamp;
    createdAt?: Timestamp;
}

class StorageServiceImpl extends FirestoreService<HistoryDocument> {
    constructor() {
        super('history');
    }

    /**
     * Uploads a file (Blob or File) directly to Firebase Storage.
     * @param file The file to upload.
     * @param path The storage path (e.g., 'users/uid/ref_images/id').
     * @returns The download URL.
     */
    async uploadFile(file: Blob | File, path: string): Promise<string> {
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    }

    /**
     * Uploads a file with progress tracking.
     */
    async uploadFileWithProgress(
        file: Blob | File,
        path: string,
        onProgress: (progress: number) => void
    ): Promise<string> {
        const { uploadBytesResumable } = await import('firebase/storage');
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    Logger.debug('StorageService', `Upload is ${progress}% done`);
                    onProgress(progress);
                },
                (error) => {
                    Logger.error('StorageService', 'Upload failed:', error);
                    events.emit('SYSTEM_ALERT', { level: 'error', message: 'File upload failed' });
                    reject(error);
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        Logger.info('StorageService', 'File available at', downloadURL);
                        resolve(downloadURL);
                    } catch (e) {
                        Logger.error('StorageService', 'Failed to get download URL', e);
                        events.emit('SYSTEM_ALERT', { level: 'error', message: 'Failed to retrieve file URL' });
                        reject(e);
                    }
                }
            );
        });
    }

    async deleteFile(path: string): Promise<void> {
        try {
            const storageRef = ref(storage, path);
            await deleteObject(storageRef);
        } catch (error) {
            // Silently fail storage cleanup if file missing
        }
    }

    /**
     * Save item with automatic cloud upload for large images
     */
    async saveItem(item: HistoryItem) {
        let imageUrl = item.url;
        let thumbnailUrl: string | undefined;

        // If it's a base64 data URL, use CloudStorageService
        if (item.url.startsWith('data:')) {
            const { auth } = await import('./firebase');
            const userId = auth.currentUser?.uid;

            // Phase 1 Optimization: Always attempt upload if size > 500KB
            const isLarge = item.url.length > 500000;

            if (userId) {
                try {
                    const result = await CloudStorageService.smartSave(
                        item.url,
                        item.id,
                        userId
                    );
                    imageUrl = result.url;
                    thumbnailUrl = result.thumbnailUrl;
                    console.log(`[StorageService] Image saved (${result.strategy}):`, item.id);
                } catch (error) {
                    console.error('[StorageService] Cloud upload failed:', error);
                    // Critical protection: If it's large and upload failed, we CANNOT save it as-is
                    if (isLarge) {
                        imageUrl = 'placeholder:upload-failed-large-asset';
                        console.error('[StorageService] Asset too large for Firestore, set to placeholder');
                        events.emit('SYSTEM_ALERT', { level: 'warning', message: 'Large image upload failed. Saved as placeholder.' });
                    }
                }
            } else if (import.meta.env.DEV) {
                if (isLarge) {
                    console.warn('[StorageService] No auth in dev - large image blocked. Use proper auth.');
                    imageUrl = 'placeholder:dev-unauthenticated-large-asset';
                }
            }
        }

        // Get Current Org ID
        const orgId = OrganizationService.getCurrentOrgId();
        const { auth } = await import('./firebase');

        // DEV BYPASS: If no user is logged in during dev, skip Firestore to prevent permission errors
        if (import.meta.env.DEV && !auth.currentUser) {
            console.warn("StorageService: Skipping Firestore write (Unauthenticated Dev Session)");
            return item.id;
        }

        // Use 'set' instead of 'add' to ensure Firestore ID matches local ID
        await this.set(item.id, {
            ...item,
            url: imageUrl,
            thumbnailUrl,
            timestamp: Timestamp.fromMillis(item.timestamp),
            projectId: item.projectId || 'default-project',
            orgId: orgId || 'personal',
            userId: auth.currentUser?.uid || null
        } as HistoryDocument);

        return item.id;

    }

    /**
     * Deletes an item from both Firestore and Firebase Storage.
     * @param id The ID of the item to remove.
     */
    async removeItem(id: string): Promise<void> {
        // 1. Get the item first to check if it has a Storage URL
        const item = await this.get(id);

        if (item) {
            // 2. If it has a standard storage URL (not a data URI or placeholder), delete from Storage
            if (item.url && item.url.includes('firebasestorage.googleapis.com')) {
                // Extract path from URL or assume standard path
                await this.deleteFile(`generated/${id}`);
            }
        }

        // 3. Delete from Firestore
        await this.delete(id);
    }

    async loadHistory(limitCount = 50): Promise<HistoryItem[]> {

        const orgId = OrganizationService.getCurrentOrgId() || 'personal';

        if (!orgId) {
            console.warn("No organization selected, returning empty history.");
            return [];
        }

        // Try standard query with server-side sort
        try {
            const { auth } = await import('./firebase');
            const constraints = [
                where('orgId', '==', orgId),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            ];

            // If personal org, we must filter by userId to match security rules
            if (orgId === 'personal') {
                if (auth.currentUser?.uid) {
                    constraints.push(where('userId', '==', auth.currentUser.uid));
                } else {
                    return [];
                }
            }

            return (await this.query(constraints)).map(doc => this.mapDocumentToItem(doc));
        } catch (e: unknown) {
            const error = e as { code?: string; message?: string };
            // Check if it's the index error
            if (error.code === 'failed-precondition' || error.message?.includes('index')) {
                const { auth } = await import('./firebase');
                const constraints = [where('orgId', '==', orgId), limit(limitCount)];

                // Only filter by userId for personal org
                if (orgId === 'personal') {
                    if (auth.currentUser) {
                        constraints.push(where('userId', '==', auth.currentUser.uid));
                    } else {
                        return [];
                    }
                }

                // Fallback to client-side sort
                const results = await this.query(
                    constraints,
                    (a, b) => {
                        const timeA = a.timestamp.toMillis();
                        const timeB = b.timestamp.toMillis();
                        return timeB - timeA;
                    }
                );
                return results.map(doc => this.mapDocumentToItem(doc));
            }
            throw error;
        }

    }

    private mapDocumentToItem(doc: HistoryDocument): HistoryItem {
        return {
            ...doc,
            timestamp: doc.timestamp.toMillis()
        } as HistoryItem;
    }
}

export const StorageService = new StorageServiceImpl();
