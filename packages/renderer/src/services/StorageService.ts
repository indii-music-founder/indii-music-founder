import { logger } from '@/utils/logger';

import { storage } from './firebase';
import { Timestamp, where, orderBy, limit, query, onSnapshot, Unsubscribe, QuerySnapshot, DocumentData, QueryDocumentSnapshot, FirestoreError } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { HistoryItem } from '@/core/types/history';
import { FirestoreService } from './FirestoreService';
import { CloudStorageService } from './CloudStorageService';
import { OrganizationService } from './OrganizationService';
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
     * Item 362: Resize and convert an image file to WebP on the client before upload.
     * Caps at 3000x3000px and converts to WebP (quality 0.9) to reduce bandwidth.
     * Falls back to original file if canvas API is unavailable.
     */
    async optimizeImageForUpload(file: File, maxSize = 3000): Promise<Blob> {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/') || typeof document === 'undefined') {
                resolve(file);
                return;
            }
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let { width, height } = img;
                if (width > maxSize || height > maxSize) {
                    const scale = maxSize / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(file); return; }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob ?? file), 'image/webp', 0.9);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    }

    /**
     * Uploads a file (Blob or File) directly to Firebase Storage.
     * @param file The file to upload.
     * @param path The storage path (e.g., 'users/uid/ref_images/id').
     * @returns The download URL.
     */
    async uploadFile(file: Blob | File, path: string): Promise<string> {
        const { auth } = await import('./firebase');
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to upload files.');
        }

        try {
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            return await getDownloadURL(storageRef);
        } catch (error: unknown) {
            logger.error(`StorageService: Upload failed for ${path}`, error);
            throw error;
        }
    }

    /**
     * Uploads a file with progress tracking.
     */
    async uploadFileWithProgress(
        file: Blob | File,
        path: string,
        onProgress: (progress: number) => void
    ): Promise<string> {
        const { auth } = await import('./firebase');
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to upload files.');
        }

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
                    } catch (e: unknown) {
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
        } catch (_error: unknown) {
            // Silently fail storage cleanup if file missing
        }
    }

    /**
     * Save item with automatic cloud upload for large images
     */
    async saveItem(item: HistoryItem) {
        let imageUrl = item.url;
        let thumbnailUrl: string | undefined;

        // 🔥 Handle blob: URLs for video items — blob: URLs are session-scoped
        // and become invalid after page refresh. We must upload to Firebase Storage
        // and persist the durable https:// URL to the history collection.
        if (item.url.startsWith('blob:') && item.type === 'video') {
            const { auth } = await import('./firebase');
            const userId = auth.currentUser?.uid;

            if (userId) {
                try {
                    const blobResponse = await fetch(item.url);
                    const blob = await blobResponse.blob();
                    const file = new File([blob], `veo_${item.id}.mp4`, { type: 'video/mp4' });

                    const { VideoUploadService } = await import('./video/VideoUploadService');
                    const storagePath = `videos/${userId}/${item.id}.mp4`;
                    const uploadResult = await VideoUploadService.uploadVideo(file, storagePath);

                    imageUrl = uploadResult.url;
                    thumbnailUrl = uploadResult.thumbnailUrl;
                    logger.info(`[StorageService] Video uploaded to Storage: ${uploadResult.url}`);
                    if (thumbnailUrl) {
                        logger.info(`[StorageService] Video thumbnail: ${thumbnailUrl}`);
                    }
                } catch (uploadError: unknown) {
                    logger.error('[StorageService] Video blob upload failed:', uploadError);
                    throw uploadError;
                }
            } else {
                throw new Error('User must be authenticated to upload generated video assets.');
            }
        }

        // If it's a base64 data URL, use CloudStorageService
        if (item.url.startsWith('data:')) {
            const { auth } = await import('./firebase');
            const userId = auth.currentUser?.uid;

            if (userId) {
                try {
                    const result = await CloudStorageService.smartSave(
                        item.url,
                        item.id,
                        userId
                    );
                    imageUrl = result.url;
                    thumbnailUrl = result.thumbnailUrl;
                    logger.debug(`[StorageService] Image saved (${result.strategy}):`, item.id);
                } catch (error: unknown) {
                    logger.error('[StorageService] Cloud upload failed:', error);
                    events.emit('SYSTEM_ALERT', { level: 'error', message: 'Image upload failed' });
                    throw error;
                }
            } else {
                throw new Error('User must be authenticated to upload generated image assets.');
            }
        }

        // Get Current Org ID
        const orgId = OrganizationService.getCurrentOrgId();
        const { auth } = await import('./firebase');
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to save generated history.');
        }

        // Use 'set' instead of 'add' to ensure Firestore ID matches local ID
        await this.set(item.id, {
            ...item,
            url: imageUrl,
            thumbnailUrl,
            timestamp: Timestamp.fromMillis(item.timestamp),
            projectId: item.projectId || 'default-project',
            orgId: orgId || 'personal',
            userId: auth.currentUser.uid
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
            logger.warn("No organization selected, returning empty history.");
            return [];
        }

        // Try standard query with server-side sort
        try {
            const { auth } = await import('./firebase');
            
            if (!auth.currentUser?.uid) {
                return [];
            }
            
            const constraints = [
                where('orgId', '==', orgId),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            ];

            // If personal org, we must filter by userId to match security rules
            if (orgId === 'personal') {
                constraints.push(where('userId', '==', auth.currentUser.uid));
            }

            return (await this.query(constraints)).map(doc => this.mapDocumentToItem(doc));
        } catch (e: unknown) {
            const error = e as { code?: string; message?: string };
            // Check if it's the index error
            if (error.code === 'failed-precondition' || error.message?.includes('index')) {
                const { auth } = await import('./firebase');
                
                if (!auth.currentUser?.uid) {
                    return [];
                }
                
                const constraints = [where('orgId', '==', orgId), limit(limitCount)];

                // Only filter by userId for personal org
                if (orgId === 'personal') {
                    constraints.push(where('userId', '==', auth.currentUser.uid));
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

    /**
     * Subscribes to history items in real-time.
     */
    async subscribeToHistory(
        limitCount = 50,
        onUpdate: (items: HistoryItem[]) => void,
        onError: (error: Error) => void
    ): Promise<Unsubscribe> {
        const orgId = OrganizationService.getCurrentOrgId() || 'personal';

        if (!orgId) {
            logger.warn("No organization selected, returning empty history subscription.");
            onUpdate([]);
            return () => { };
        }

        const { auth } = await import('./firebase');
        
        if (!auth.currentUser?.uid) {
            onUpdate([]);
            return () => { };
        }
        
        const constraints = [
            where('orgId', '==', orgId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        ];

        if (orgId === 'personal') {
            constraints.push(where('userId', '==', auth.currentUser.uid));
        }

        const q = query(this.collection, ...constraints);

        let unsubscribe: Unsubscribe | null = null;
        let isUnsubscribed = false;

        const originalUnsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const items = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
                const data = doc.data() as HistoryDocument;
                return this.mapDocumentToItem({ ...data, id: doc.id });
            });
            onUpdate(items);
        }, (error: FirestoreError | Error & { code?: string }) => {
            // Check if it's an index error, fallback to un-ordered query if so
            if (error.code === 'failed-precondition' || error.message.includes('index')) {
                logger.warn('[StorageService] Index missing for history subscription, falling back to client-side sort.');

                const fallbackConstraints = [
                    where('orgId', '==', orgId),
                    limit(limitCount)
                ];

                if (orgId === 'personal' && auth.currentUser?.uid) {
                    fallbackConstraints.push(where('userId', '==', auth.currentUser.uid));
                }

                const fallbackQ = query(this.collection, ...fallbackConstraints);

                unsubscribe = onSnapshot(fallbackQ, (fallbackSnap: QuerySnapshot<DocumentData>) => {
                    const items = fallbackSnap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
                        const data = doc.data() as HistoryDocument;
                        return this.mapDocumentToItem({ ...data, id: doc.id });
                    });

                    // Client-side sort
                    items.sort((a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp);
                    onUpdate(items);
                }, onError);

                // If user called the wrapper's unsubscribe before fallback finished attaching
                if (isUnsubscribed && unsubscribe) {
                    unsubscribe();
                }
            } else {
                if (onError) onError(error);
            }
        });

        // If fallback hasn't happened yet, set inner to original
        if (!unsubscribe) {
            unsubscribe = originalUnsubscribe;
        }

        return () => {
            isUnsubscribed = true;
            if (unsubscribe) unsubscribe();
        };
    }

    private mapDocumentToItem(doc: HistoryDocument): HistoryItem {
        return {
            ...doc,
            timestamp: doc.timestamp.toMillis()
        } as HistoryItem;
    }
}

export const StorageService = new StorageServiceImpl();
