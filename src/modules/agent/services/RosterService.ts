import { db } from '@/services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';
import { Venue } from '../types';

// Validation Schema
export const RosterItemSchema = z.object({
    venueId: z.string(),
    name: z.string().min(1),
    city: z.string(),
    status: z.enum(['active', 'closed', 'unknown']).optional(),
    addedAt: z.any() // Timestamp
});

export class RosterService {
    /**
     * Adds a venue to the user's roster.
     * Uses Firestore: users/{userId}/roster/{venueId}
     */
    static async addToRoster(venue: Venue): Promise<void> {
        // In a real app, we'd get the current user ID from Auth Context
        // For Alpha/Mock, we'll use a hardcoded dev user ID or get it from a store if available.
        // Let's assume a dev-user for now since we are in "Guest Login" mode.
        const userId = 'dev-user';

        const rosterRef = doc(db, `users/${userId}/roster/${venue.id}`);

        const rosterItem = {
            venueId: venue.id,
            name: venue.name,
            city: venue.city,
            status: venue.status,
            addedAt: serverTimestamp()
        };

        // Validate before send (Bolt Principle: Data Integrity)
        RosterItemSchema.parse(rosterItem);

        await setDoc(rosterRef, rosterItem);
    }
}
