import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Itinerary, VehicleStats } from '@/modules/touring/types';

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
    getVehicleStats: async (userId: string): Promise<VehicleStats> => {
        const q = query(
            collection(db, 'tour_vehicles'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as VehicleStats;
        }

        // Auto-seed if missing
        console.log("Seeding Touring Database...");
        const initialStats: Omit<VehicleStats, 'id'> = {
            userId,
            milesDriven: 12500,
            fuelLevelPercent: 85,
            tankSizeGallons: 15, // Standard tank
            mpg: 28, // Good economy
            gasPricePerGallon: 3.85,
            updatedAt: serverTimestamp()
        };
        await addDoc(collection(db, 'tour_vehicles'), initialStats);
        return {
            id: 'generated_seed',
            ...initialStats
        } as VehicleStats;
    },

    /**
     * Save/Update Vehicle Stats
     */
    saveVehicleStats: async (userId: string, stats: Partial<VehicleStats>) => {
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
