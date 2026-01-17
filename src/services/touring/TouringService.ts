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
import { VehicleStats, Itinerary } from '@/modules/touring/types';
import { z } from 'zod';

const VEHICLES_COLLECTION = 'tour_vehicles';
const ITINERARIES_COLLECTION = 'tour_itineraries';

// Zod Schemas for Runtime Validation
export const ItineraryStopSchema = z.object({
    date: z.string(),
    city: z.string(),
    venue: z.string(),
    activity: z.string(),
    notes: z.string(),
    type: z.string().optional(),
    distance: z.number().optional()
});

export const ItinerarySchema = z.object({
    userId: z.string(),
    tourName: z.string(),
    stops: z.array(ItineraryStopSchema),
    totalDistance: z.string(),
    estimatedBudget: z.string(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional()
});

export const VehicleStatsSchema = z.object({
    userId: z.string(),
    milesDriven: z.number(),
    fuelLevelPercent: z.number(),
    tankSizeGallons: z.number(),
    mpg: z.number(),
    gasPricePerGallon: z.number(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional()
});

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
                try {
                    VehicleStatsSchema.passthrough().parse(data);
                    return {
                        id: snapshot.docs[0].id,
                        ...data
                    } as VehicleStats;
                } catch (validationError) {
                    console.error('Invalid VehicleStats data:', validationError);
                    // Decide whether to return partial data or null.
                    // For safety, returning null forces a fallback/re-seed flow or error state.
                    return null;
                }
            }
            return null;
        } catch (error) {
            console.error('Error fetching vehicle stats:', error);
            throw error;
        }
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
            const items = snapshot.docs.map(doc => {
                const data = doc.data();
                try {
                    ItinerarySchema.passthrough().parse(data);
                    return {
                        id: doc.id,
                        ...data
                    } as Itinerary;
                } catch (validationError) {
                    console.warn(`Skipping invalid itinerary ${doc.id}:`, validationError);
                    return null;
                }
            }).filter((item): item is Itinerary => item !== null);
            callback(items);
        });
    },

    /**
     * Save/Create an itinerary
     */
    saveItinerary: async (itinerary: Omit<Itinerary, 'id'>) => {
        // Validate input before sending to DB
        ItinerarySchema.omit({ createdAt: true, updatedAt: true }).passthrough().parse(itinerary);

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
            // Validate creation payload if possible, though 'stats' is Partial.
            // We assume the merging with existing data or defaults happens upstream or we trust the partial update.
            // However, creating a NEW doc requires checks.

            // If we are creating, we expect essential fields.
            // Ideally we should enforce full object for creation, but following existing signature:
            await addDoc(collection(db, VEHICLES_COLLECTION), {
                ...stats,
                userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    }
};
