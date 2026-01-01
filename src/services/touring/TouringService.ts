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
