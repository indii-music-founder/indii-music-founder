import { db } from '@/services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';
import { Venue } from '../types';
import { useStore } from '@/core/store';

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
     * ISSUE-901: Gets authenticated user ID from Zustand store, not hardcoded.
     */
    static async addToRoster(venue: Venue): Promise<void> {
        // ISSUE-901: Get the real authenticated user from the store
        const state = useStore.getState();
        const userId = state.user?.uid;

        if (!userId) {
            throw new Error('Cannot add to roster: User is not authenticated. Use real Auth context, not guest mode.');
        }

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
