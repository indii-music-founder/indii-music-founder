
import { db, storage } from './firebase';
import { collection, query, orderBy, limit, Timestamp, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { HistoryItem } from '../core/store';
import { OrganizationService } from './OrganizationService';
import { FirestoreService } from './FirestoreService';

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
        try {
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            return await getDownloadURL(storageRef);
        } catch (error) {
            // Error logged silently or via dedicated service if available
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
        const { uploadBytesResumable } = await import('firebase/storage');
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    onProgress(progress);
                },
                (error) => {
                    reject(error);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
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

    async saveItem(item: HistoryItem) {
        try {
            let imageUrl = item.url;

            // If it's a base64 data URL, upload to Storage
            if (item.url.startsWith('data:')) {
                // FALLBACK FOR DEV: Bypass Storage upload to avoid CORS/Auth issues locally
                if (import.meta.env.DEV) {
                    // CRITICAL: Firestore has a 1MB limit for document size.
                    // If the data URI is too large, we store a placeholder in Firestore
                    // to avoid "Value too large" errors, while keeping the real URI in local state.
                    if (item.url.length > 800000) { // ~800KB safety margin
                        imageUrl = 'placeholder:dev-data-uri-too-large';
                    }
                } else {
                    const storageRef = ref(storage, `generated/${item.id}`);
                    await uploadString(storageRef, item.url, 'data_url');
                    imageUrl = await getDownloadURL(storageRef);
                }
            }

            // Get Current Org ID
            const orgId = OrganizationService.getCurrentOrgId();
            const { auth } = await import('./firebase');

            // Use 'set' instead of 'add' to ensure Firestore ID matches local ID
            await this.set(item.id, {
                ...item,
                url: imageUrl,
                timestamp: Timestamp.fromMillis(item.timestamp),
                orgId: orgId || 'personal',
                userId: auth.currentUser?.uid || null
            } as HistoryDocument);

            return item.id;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Deletes an item from both Firestore and Firebase Storage.
     * @param id The ID of the item to remove.
     */
    async removeItem(id: string): Promise<void> {
        try {
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
        } catch (error) {
            throw error;
        }
    }

    async loadHistory(limitCount = 50): Promise<HistoryItem[]> {
        try {
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
        } catch (e) {
            throw e;
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

