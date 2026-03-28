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
import { VehicleStats, Itinerary } from '@/modules/touring/types';
import { TourVehicleDocument, TourItineraryDocument } from '@/types/firestore';
import { z } from 'zod';
import { logger } from '@/utils/logger';

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
    createdAt: z.instanceof(Timestamp).optional(),
    updatedAt: z.instanceof(Timestamp).optional()
});

export const VehicleStatsSchema = z.object({
    userId: z.string(),
    milesDriven: z.number(),
    fuelLevelPercent: z.number(),
    tankSizeGallons: z.number(),
    mpg: z.number(),
    gasPricePerGallon: z.number(),
    createdAt: z.instanceof(Timestamp).optional(),
    updatedAt: z.instanceof(Timestamp).optional()
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
                const docSnapshot = snapshot.docs[0]!;
                const data = docSnapshot.data() as TourVehicleDocument;
                try {
                    const validated = VehicleStatsSchema.passthrough().parse(data);
                    return {
                        ...validated,
                        id: docSnapshot.id,
                        createdAt: validated.createdAt,
                        updatedAt: validated.updatedAt
                    } as VehicleStats;
                } catch (validationError) {
                    logger.error('Invalid VehicleStats data:', validationError);
                    return null;
                }
            }
            return null;
        } catch (error: unknown) {
            const code = (error as { code?: string })?.code;
            if (code === 'permission-denied') {
                logger.debug('[Touring] Vehicle stats unavailable — insufficient permissions (expected in dev).');
                return null;
            }
            logger.error('Error fetching vehicle stats:', error);
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
            const items = snapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data() as TourItineraryDocument;
                try {
                    const validated = ItinerarySchema.passthrough().parse(data);
                    return {
                        ...validated,
                        id: docSnapshot.id,
                        createdAt: validated.createdAt
                    } as Itinerary;
                } catch (validationError) {
                    logger.warn(`Skipping invalid itinerary ${docSnapshot.id}:`, validationError);
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
        const validated = ItinerarySchema.omit({ createdAt: true, updatedAt: true }).passthrough().parse(itinerary);

        await addDoc(collection(db, ITINERARIES_COLLECTION), {
            ...validated,
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
            const docRef = snapshot.docs[0]!.ref;
            await updateDoc(docRef, { ...stats, updatedAt: serverTimestamp() });
        } else {
            // If we are creating, we expect essential fields from standard partial updates
            await addDoc(collection(db, VEHICLES_COLLECTION), {
                ...stats,
                userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    }
};
