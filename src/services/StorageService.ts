import { db, storage, auth } from './firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { HistoryItem } from '../core/store';
import { OrganizationService } from './OrganizationService';

export const StorageService = {
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
            const docData = {
                ...item,
                url: imageUrl,
                timestamp: Timestamp.fromMillis(item.timestamp),
                orgId: orgId || 'personal' // Default to 'personal' if no org selected
            };
            const docRef = await addDoc(collection(db, 'history'), docData);
            console.log("Document written with ID: ", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("Error adding document: ", e);
            throw e;
        }
    },

    async loadHistory(limitCount = 50): Promise<HistoryItem[]> {
        try {
            const orgId = OrganizationService.getCurrentOrgId() || 'personal';

            // Query with Org Filter
            // Note: This requires a composite index in Firestore (orgId + timestamp)
            if (!orgId) {
                // This block is now unreachable if we default to 'personal', but keeping for safety if logic changes
                console.warn("No organization selected, returning empty history.");
                return [];
            }

            // Query with Org Filter
            // Note: This requires a composite index in Firestore (orgId + timestamp)
            let q;
            try {
                q = query(
                    collection(db, 'history'),
                    where('orgId', '==', orgId),
                    orderBy('timestamp', 'desc'),
                    limit(limitCount)
                );
            } catch (e) {
                // Fallback if query construction fails (unlikely)
                console.warn("Query construction failed:", e);
                q = query(collection(db, 'history'), where('orgId', '==', orgId), limit(limitCount));
            }

            try {
                const querySnapshot = await getDocs(q);
                let items = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    let ts = Date.now();
                    if (data.timestamp) {
                        if (typeof data.timestamp.toMillis === 'function') {
                            ts = data.timestamp.toMillis();
                        } else if (typeof data.timestamp === 'number') {
                            ts = data.timestamp;
                        }
                    }

                    return {
                        ...data,
                        id: doc.id,
                        timestamp: ts
                    } as HistoryItem;
                });

                return items;
            } catch (error: any) {
                // Check if it's the index error
                if (error.code === 'failed-precondition' || error.message.includes('index')) {
                    console.warn("Firestore index missing for sorting. Falling back to client-side sorting.");

                    // Fallback to simple filtering (Firebase can do single field filter without composite index)
                    // We might need to remove orderBy and do it manually
                    const fallbackQuery = query(
                        collection(db, 'history'),
                        where('orgId', '==', orgId),
                        limit(limitCount)
                    );

                    const fallbackSnapshot = await getDocs(fallbackQuery);
                    const items = fallbackSnapshot.docs.map(doc => {
                        const data = doc.data();
                        let ts = Date.now();
                        if (data.timestamp) {
                            if (typeof data.timestamp.toMillis === 'function') {
                                ts = data.timestamp.toMillis();
                            } else if (typeof data.timestamp === 'number') {
                                ts = data.timestamp;
                            }
                        }

                        return {
                            ...data,
                            id: doc.id,
                            timestamp: ts
                        } as HistoryItem;
                    });

                    // Sort client-side
                    return items.sort((a, b) => b.timestamp - a.timestamp);
                }
                throw error;
            }
        } catch (e) {
            console.error("Error loading history: ", e);
            return [];
        }
    }
};
