import { db, storage, auth } from './firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { HistoryItem } from '../core/store';

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

            // Ensure timestamp is a number or Firestore Timestamp
            const docData = {
                ...item,
                url: imageUrl,
                timestamp: Timestamp.fromMillis(item.timestamp)
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
            // Re-enable orderBy now that we suspect size limit was the issue
            const q = query(collection(db, 'history'), orderBy('timestamp', 'desc'), limit(limitCount));
            // const q = query(collection(db, 'history'), limit(limitCount));
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
