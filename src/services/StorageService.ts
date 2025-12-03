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
            const orgId = OrganizationService.getCurrentOrgId();

            // Query with Org Filter
            // Note: This requires a composite index in Firestore (orgId + timestamp)
            if (!orgId) {
                console.warn("No organization selected, returning empty history.");
                return [];
            }

            // Query with Org Filter
            // Note: This requires a composite index in Firestore (orgId + timestamp)
            const q = query(
                collection(db, 'history'),
                where('orgId', '==', orgId),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => {
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
        } catch (e) {
            console.error("Error loading history: ", e);
            return [];
        }
    }
};
