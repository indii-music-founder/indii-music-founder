
import { db, storage } from './firebase';
import { collection, query, orderBy, limit, Timestamp, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { HistoryItem } from '../core/store';
import { OrganizationService } from './OrganizationService';
import { FirestoreService } from './FirestoreService';

class StorageServiceImpl extends FirestoreService<HistoryItem> {
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
            console.error("Error uploading file to storage:", error);
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
                    console.error("Error uploading file with progress:", error);
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
            console.warn("Error deleting file from storage:", error);
            // Don't throw, just warn, as the record might be missing
        }
    }

    async saveItem(item: HistoryItem) {
        try {
            let imageUrl = item.url;

            // If it's a base64 data URL, upload to Storage
            if (item.url.startsWith('data:')) {
                const storageRef = ref(storage, `generated/${item.id}`);
                await uploadString(storageRef, item.url, 'data_url');
                imageUrl = await getDownloadURL(storageRef);
            }

            // Get Current Org ID
            const orgId = OrganizationService.getCurrentOrgId();

            const { auth } = await import('./firebase');

            // Ensure timestamp is a number or Firestore Timestamp
            // We use Omit<HistoryItem, 'id'> to match add method signature, 
            // but we need to override the type check slightly or construct manually
            const docData = {
                ...item,
                url: imageUrl,
                timestamp: Timestamp.fromMillis(item.timestamp),
                orgId: orgId || 'personal', // Default to 'personal' if no org selected
                userId: auth.currentUser?.uid || null // Explicitly save userId, default to null to avoid Firestore undefined error
            };

            // Casting as specific data to satisfy TS, assuming FirestoreService handles ID generation
            // Actually, we want to specify ID if item.id is present?
            // Base FirestoreService.add generates ID. 
            // But StorageService.saveItem assumes item has an ID already locally generated?
            // Looking at original code: "const docRef = await addDoc(collection(db, 'history'), docData);"
            // So it generates a NEW ID in Firestore.

            // We need to type cast to any because docData contains Timestamp instead of number
            const id = await this.add(docData as any);
            console.log("Document written with ID: ", id);
            return id;
        } catch (e) {
            console.error("Error adding document: ", e);
            throw e;
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

                return await this.query(constraints);
            } catch (e: unknown) {
                const error = e as any; // Cast to access Firebase error properties
                // Check if it's the index error
                if (error.code === 'failed-precondition' || error.message?.includes('index')) {
                    console.warn("Firestore index missing for sorting. Falling back to client-side sorting.");

                    const { auth } = await import('./firebase');
                    const constraints = [where('orgId', '==', orgId), limit(limitCount)];

                    // Only filter by userId for personal org (matches primary query path logic)
                    if (orgId === 'personal') {
                        if (auth.currentUser) {
                            constraints.push(where('userId', '==', auth.currentUser.uid));
                        } else {
                            return [];
                        }
                    }

                    // Fallback to client-side sort using inherited query method's sorter
                    return await this.query(
                        constraints,
                        (a, b) => {
                            const timeA = (a.timestamp as any)?.toMillis ? (a.timestamp as any).toMillis() : a.timestamp;
                            const timeB = (b.timestamp as any)?.toMillis ? (b.timestamp as any).toMillis() : b.timestamp;
                            return (timeB as number) - (timeA as number);
                        }
                    );
                }
                throw error;
            }
        } catch (e) {
            console.error("Error loading history: ", e);
            return [];
        }
    }
}

export const StorageService = new StorageServiceImpl();

