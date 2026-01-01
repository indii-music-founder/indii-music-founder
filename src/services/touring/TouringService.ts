
import { db } from '@/services/firebase';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    Timestamp
} from 'firebase/firestore';
import { VehicleStats, Itinerary, ItineraryStop } from '@/modules/touring/types';

const VEHICLES_COLLECTION = 'tour_vehicles';
const ITINERARIES_COLLECTION = 'tour_itineraries';

export const TouringService = {
    /**
     * Get vehicle stats for a user.
     * Returns null if not found, allowing the consumer to decide when to seed.
     */
    getVehicleStats: async (userId: string): Promise<VehicleStats | null> => {
        try {
            const q = query(
                collection(db, VEHICLES_COLLECTION),
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                return {
                    id: snapshot.docs[0].id,
                    ...data
                } as VehicleStats;
            }
            return null;
        } catch (error) {
            console.error('Error fetching vehicle stats:', error);
            throw error;
        }
    },

    /**
     * Seed initial vehicle stats.
     */
    seedDatabase: async (userId: string): Promise<VehicleStats> => {
        const initialStats = {
            userId,
            milesDriven: 0,
            fuelLevelPercent: 100,
            tankSizeGallons: 150,
            mpg: 8,
            gasPricePerGallon: 4.50,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, VEHICLES_COLLECTION), initialStats);
        return {
            id: docRef.id,
            ...initialStats,
            createdAt: new Date().toISOString() // Approximate for immediate UI return
        } as unknown as VehicleStats;
    },

    /**
     * Subscribe to user's itineraries
     */
    subscribeToItineraries: (userId: string, callback: (itineraries: Itinerary[]) => void) => {
        const q = query(
            collection(db, ITINERARIES_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
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
        await addDoc(collection(db, ITINERARIES_COLLECTION), {
            ...itinerary,
            createdAt: serverTimestamp()
        });
    },

    /**
     * Update an itinerary
     */
    updateItinerary: async (id: string, updates: Partial<Itinerary>) => {
        const docRef = doc(db, ITINERARIES_COLLECTION, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Save/Update Vehicle Stats
     */
    saveVehicleStats: async (userId: string, stats: Partial<VehicleStats>) => {
        const q = query(
            collection(db, VEHICLES_COLLECTION),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            await updateDoc(docRef, { ...stats, updatedAt: serverTimestamp() });
        } else {
            // If doesn't exist, create it
            await addDoc(collection(db, VEHICLES_COLLECTION), {
                ...stats,
                userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    }
};
