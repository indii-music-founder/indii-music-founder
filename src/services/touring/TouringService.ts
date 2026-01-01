import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Itinerary } from '@/modules/touring/types';

const COLLECTION_NAME = 'tour_itineraries';

export const TouringService = {
    /**
     * Subscribe to user's itineraries
     */
    subscribeToItineraries: (userId: string, callback: (itineraries: Itinerary[]) => void) => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Itinerary[];
            callback(items);
        });
    },

    /**
     * Save/Create an itinerary
     */
    saveItinerary: async (itinerary: Omit<Itinerary, 'id'>) => {
        await addDoc(collection(db, COLLECTION_NAME), {
            ...itinerary,
            createdAt: serverTimestamp()
        });
    },

    /**
     * Update an itinerary
     */
    updateItinerary: async (id: string, updates: Partial<Itinerary>) => {
        await updateDoc(doc(db, COLLECTION_NAME, id), updates);
    },

    /**
     * Get Vehicle Stats
     */
    /**
     * Get Vehicle Stats
     */
    getVehicleStats: async (userId: string) => {
        const q = query(
            collection(db, 'tour_vehicles'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
        }

        // Auto-seed if missing
        console.log("Seeding Touring Database...");
        const initialStats = {
            userId,
            condition: 95,
            fuel: 85,
            mileage: 12500,
            maintenanceDue: false,
            nextService: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
            updatedAt: serverTimestamp()
        };
        await addDoc(collection(db, 'tour_vehicles'), initialStats);
        return {
            id: 'generated_seed',
            ...initialStats,
            nextService: { toMillis: () => Date.now() + 1000 * 60 * 60 * 24 * 30 } // Mock timestamp behavior for immediate return
        } as any;
    },

    /**
     * Save/Update Vehicle Stats
     */
    saveVehicleStats: async (userId: string, stats: any) => {
        const q = query(
            collection(db, 'tour_vehicles'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            await updateDoc(docRef, { ...stats, updatedAt: serverTimestamp() });
        } else {
            await addDoc(collection(db, 'tour_vehicles'), {
                ...stats,
                userId,
                updatedAt: serverTimestamp()
            });
        }
    }
};
