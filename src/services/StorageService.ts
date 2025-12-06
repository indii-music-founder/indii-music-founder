
import { db, storage } from './firebase';
import { collection, query, orderBy, limit, Timestamp, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { HistoryItem } from '../core/store';
import { OrganizationService } from './OrganizationService';
import { FirestoreService } from './FirestoreService';

class StorageServiceImpl extends FirestoreService<HistoryItem> {
    constructor() {
        super('history');
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

            // Ensure timestamp is a number or Firestore Timestamp
            // We use Omit<HistoryItem, 'id'> to match add method signature, 
            // but we need to override the type check slightly or construct manually
            const docData = {
                ...item,
                url: imageUrl,
                timestamp: Timestamp.fromMillis(item.timestamp),
                orgId: orgId || 'personal' // Default to 'personal' if no org selected
            };

            // Casting as specific data to satisfy TS, assuming FirestoreService handles ID generation
            // Actually, we want to specify ID if item.id is present?
            // Base FirestoreService.add generates ID. 
            // But StorageService.saveItem assumes item has an ID already locally generated?
            // Looking at original code: "const docRef = await addDoc(collection(db, 'history'), docData);"
            // So it generates a NEW ID in Firestore.

            const id = await this.add(docData as unknown as HistoryItem);
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
                return await this.query([
                    where('orgId', '==', orgId),
                    orderBy('timestamp', 'desc'),
                    limit(limitCount)
                ]);
            } catch (error: any) {
                // Check if it's the index error
                if (error.code === 'failed-precondition' || error.message?.includes('index')) {
                    console.warn("Firestore index missing for sorting. Falling back to client-side sorting.");

                    // Fallback to client-side sort using inherited query method's sorter
                    return await this.query(
                        [where('orgId', '==', orgId), limit(limitCount)],
                        (a, b) => b.timestamp - a.timestamp
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

