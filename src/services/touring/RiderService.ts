
import { db } from '@/services/firebase';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';
import { RiderItem } from '@/modules/touring/types';
import { z } from 'zod';

const COLLECTION = 'tour_rider_items';

// Schema for runtime validation
const RiderItemSchema = z.object({
    userId: z.string(),
    label: z.string(),
    completed: z.boolean(),
    category: z.enum(['food', 'drink', 'essential']),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional()
});

export const RiderService = {
    /**
     * Subscribe to rider items for a user.
     */
    subscribeToRiderItems: (userId: string, callback: (items: RiderItem[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => {
                const data = doc.data();
                try {
                    // Runtime validation
                    // We parse with passthrough to allow extra fields like id which we add manually
                    RiderItemSchema.passthrough().parse(data);
                    return {
                        id: doc.id,
                        ...data
                    } as RiderItem;
                } catch (error) {
                    console.warn(`Skipping invalid rider item ${doc.id}:`, error);
                    return null;
                }
            }).filter((item): item is RiderItem => item !== null);
            callback(items);
        });
    },

    /**
     * Add a new rider item.
     */
    addItem: async (item: Omit<RiderItem, 'id' | 'createdAt' | 'updatedAt'>) => {
        // Validate input payload
        RiderItemSchema.pick({ userId: true, label: true, completed: true, category: true }).parse(item);

        await addDoc(collection(db, COLLECTION), {
            ...item,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Update an existing rider item.
     */
    updateItem: async (id: string, updates: Partial<RiderItem>) => {
        const docRef = doc(db, COLLECTION, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Delete a rider item.
     */
    deleteItem: async (id: string) => {
        const docRef = doc(db, COLLECTION, id);
        await deleteDoc(docRef);
    }
};
