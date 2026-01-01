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
    onSnapshot
} from 'firebase/firestore';
import { VehicleStats, Itinerary, ItineraryStop } from '@/modules/touring/types';

export class TouringService {
    private static VEHICLES_COLLECTION = 'tour_vehicles';
    private static ITINERARIES_COLLECTION = 'tour_itineraries';

    /**
     * Get vehicle stats for a user.
     */
    static async getVehicleStats(userId: string): Promise<VehicleStats | null> {
        try {
            const q = query(
                collection(db, this.VEHICLES_COLLECTION),
                where('userId', '==', userId),
                orderBy('createdAt', 'desc')
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
    }

    /**
     * Seed initial vehicle stats.
     */
    static async seedDatabase(userId: string): Promise<VehicleStats> {
        const initialStats = {
            userId,
            milesDriven: 0,
            fuelLevelPercent: 100,
            tankSizeGallons: 150,
            mpg: 8,
            gasPricePerGallon: 4.50,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, this.VEHICLES_COLLECTION), initialStats);
        return {
            id: docRef.id,
            ...initialStats,
            createdAt: new Date().toISOString() // Approximate for return
        } as unknown as VehicleStats;
    }

    /**
     * Subscribe to itineraries.
     */
    static subscribeToItineraries(userId: string, callback: (itineraries: Itinerary[]) => void): () => void {
        const q = query(
            collection(db, this.ITINERARIES_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const itineraries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Itinerary));
            callback(itineraries);
        });
    }

    /**
     * Update an itinerary stop.
     */
    static async updateItineraryStop(itineraryId: string, stopIndex: number, updatedStop: ItineraryStop): Promise<void> {
        const docRef = doc(db, this.ITINERARIES_COLLECTION, itineraryId);
        // Note: Updating a specific array element in Firestore is tricky without reading the whole array.
        // For MVP, we might assume the caller passes the FULL updated itinerary or we handle it carefully.
        // Here we assume we just update the specific field if we had a map, but since 'stops' is an array,
        // we likely need to read-modify-write or use arrayRemove/arrayUnion if unique.
        // But the PR context suggests a simple update.
        // Let's assume the component handles the full array update via `updateItinerary`.
        throw new Error("Use updateItinerary for full updates");
    }

    static async updateItinerary(itineraryId: string, updates: Partial<Itinerary>): Promise<void> {
        const docRef = doc(db, this.ITINERARIES_COLLECTION, itineraryId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    }
}
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
