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
    onSnapshot,
    Timestamp
} from 'firebase/firestore';
import { Itinerary, EmergencyContact } from '@/modules/touring/types';
import { TourItineraryDocument } from '@/types/firestore';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

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

export const EmergencyContactSchema = z.object({
    userId: z.string(),
    name: z.string().min(1),
    phone: z.string().min(1),
    relationship: z.string().min(1),
    createdAt: z.instanceof(Timestamp).optional(),
    updatedAt: z.instanceof(Timestamp).optional()
});

// E2E Mock Memory Storage to bypass Firestore network calls in offline testing
let mockItineraries: Itinerary[] = [];
let mockEmergencyContacts: EmergencyContact[] = [];

const itineraryListeners = new Set<(itineraries: Itinerary[]) => void>();
const emergencyListeners = new Set<(contacts: EmergencyContact[]) => void>();

const notifyItineraryListeners = () => {
    itineraryListeners.forEach(cb => cb([...mockItineraries]));
};

const notifyEmergencyListeners = () => {
    emergencyListeners.forEach(cb => cb([...mockEmergencyContacts]));
};

export const TouringService = {


    /**
     * Subscribe to user's itineraries
     */
    subscribeToItineraries: (userId: string, callback: (itineraries: Itinerary[]) => void) => {
        if (isFirebaseE2EMockEnabled()) {
            itineraryListeners.add(callback);
            setTimeout(() => {
                callback([...mockItineraries]);
            }, 0);
            return () => {
                itineraryListeners.delete(callback);
            };
        }

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
                } catch (validationError: unknown) {
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
        if (isFirebaseE2EMockEnabled()) {
            const newItinerary: Itinerary = {
                ...itinerary,
                id: `mock-itinerary-${Date.now()}`
            };
            mockItineraries = [newItinerary, ...mockItineraries];
            notifyItineraryListeners();
            return;
        }

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
        if (isFirebaseE2EMockEnabled()) {
            mockItineraries = mockItineraries.map(it => {
                if (it.id === id) {
                    return { ...it, ...updates };
                }
                return it;
            });
            notifyItineraryListeners();
            return;
        }

        const docRef = doc(db, ITINERARIES_COLLECTION, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },



    /**
     * Subscribe to emergency contacts for a user.
     */
    subscribeToEmergencyContacts: (userId: string, callback: (contacts: EmergencyContact[]) => void) => {
        if (isFirebaseE2EMockEnabled()) {
            emergencyListeners.add(callback);
            setTimeout(() => {
                callback([...mockEmergencyContacts]);
            }, 0);
            return () => {
                emergencyListeners.delete(callback);
            };
        }

        const q = query(
            collection(db, 'tour_emergency_contacts'),
            where('userId', '==', userId)
        );

        return onSnapshot(q, {
            next: (snapshot) => {
                const items = snapshot.docs.map(docSnapshot => {
                    const data = docSnapshot.data();
                    try {
                        EmergencyContactSchema.passthrough().parse(data);
                        return {
                            id: docSnapshot.id,
                            ...data
                        } as EmergencyContact;
                    } catch (validationError: unknown) {
                        logger.warn(`Skipping invalid emergency contact ${docSnapshot.id}:`, validationError);
                        return null;
                    }
                }).filter((item): item is EmergencyContact => item !== null);
                callback(items);
            },
            error: (error) => {
                logger.error("Error in subscribeToEmergencyContacts listener:", error);
                callback([]);
            }
        });
    },

    /**
     * Save/Create/Update an emergency contact
     */
    saveEmergencyContact: async (userId: string, contact: { id?: string; name: string; phone: string; relationship: string }) => {
        if (isFirebaseE2EMockEnabled()) {
            if (contact.id) {
                mockEmergencyContacts = mockEmergencyContacts.map(c => {
                    if (c.id === contact.id) {
                        return {
                            ...c,
                            name: contact.name.trim(),
                            phone: contact.phone.trim(),
                            relationship: contact.relationship.trim()
                        };
                    }
                    return c;
                });
            } else {
                const newContact: EmergencyContact = {
                    id: `mock-contact-${Date.now()}`,
                    userId,
                    name: contact.name.trim(),
                    phone: contact.phone.trim(),
                    relationship: contact.relationship.trim()
                };
                mockEmergencyContacts = [...mockEmergencyContacts, newContact];
            }
            notifyEmergencyListeners();
            return;
        }

        const payload = {
            userId,
            name: contact.name.trim(),
            phone: contact.phone.trim(),
            relationship: contact.relationship.trim()
        };

        EmergencyContactSchema.parse(payload);

        if (contact.id) {
            const docRef = doc(db, 'tour_emergency_contacts', contact.id);
            await updateDoc(docRef, {
                ...payload,
                updatedAt: serverTimestamp()
            });
        } else {
            await addDoc(collection(db, 'tour_emergency_contacts'), {
                ...payload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    },

    /**
     * Delete an emergency contact
     */
    deleteEmergencyContact: async (id: string) => {
        if (isFirebaseE2EMockEnabled()) {
            mockEmergencyContacts = mockEmergencyContacts.filter(c => c.id !== id);
            notifyEmergencyListeners();
            return;
        }

        const docRef = doc(db, 'tour_emergency_contacts', id);
        await deleteDoc(docRef);
    }
};
