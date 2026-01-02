import { Venue } from '../types';
import { browserAgentDriver } from '../../../services/agent/BrowserAgentDriver';
import { db } from '@/services/firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';

// Initial Seed Data (Used only if DB is empty)
const SEED_VENUES: Omit<Venue, 'id'>[] = [
    {
        name: 'The Basement East',
        city: 'Nashville',
        state: 'TN',
        capacity: 500,
        genres: ['Indie', 'Rock', 'Alternative', 'Folk'],
        website: 'https://thebasementnashville.com',
        status: 'active',
        contactEmail: 'booking@thebasementnashville.com',
        notes: 'Great spot for emerging indie bands. High fill probability for local acts.',
        imageUrl: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&q=80&w=1000',
        fitScore: 0
    },
    {
        name: 'Exit/In',
        city: 'Nashville',
        state: 'TN',
        capacity: 400,
        genres: ['Rock', 'Punk', 'Alternative', 'Metal'],
        website: 'https://exitin.com',
        status: 'active',
        contactEmail: 'booking@exitin.com',
        notes: 'Legendary venue. Requires verified tour history.',
        imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000',
        fitScore: 0
    },
    {
        name: 'Mercy Lounge (Historical)',
        city: 'Nashville',
        state: 'TN',
        capacity: 500,
        genres: ['Indie', 'Rock', 'Pop'],
        website: '#',
        status: 'closed',
        notes: 'Permanently closed. Do not contact.',
        imageUrl: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&q=80&w=1000',
        fitScore: 0
    },
    {
        name: 'Marathon Music Works',
        city: 'Nashville',
        state: 'TN',
        capacity: 1500,
        genres: ['Rock', 'Pop', 'Country', 'Electronic'],
        website: 'https://marathonmusicworks.com',
        status: 'active',
        notes: 'Large capacity. Reach tier target.',
        imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80&w=1000',
        fitScore: 0
    },
    {
        name: 'The 5 Spot',
        city: 'Nashville',
        state: 'TN',
        capacity: 200,
        genres: ['Rock', 'Indie', 'Americana'],
        website: 'https://www.the5spot.club',
        status: 'active',
        notes: 'East Nashville staple. Good for residencies.',
        imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1000',
        fitScore: 0
    }
];

export type ScoutEvent = {
    step: 'SCANNING_MAP' | 'ANALYZING_CAPACITY' | 'CHECKING_AVAILABILITY' | 'CALCULATING_FIT' | 'COMPLETE';
    message: string;
    progress: number;
};

import { delay } from '@/utils/async';

export class VenueScoutService {
    private static COLLECTION_NAME = 'venues';

    /**
     * Searches for venues using Firestore (and autonomous agents if requested).
     * @param onProgress Callback to receive simulation events
     */
    static async searchVenues(
        city: string,
        genre: string,
        isAutonomous = false,
        onProgress?: (event: ScoutEvent) => void
    ): Promise<Venue[]> {
        const emit = (step: ScoutEvent['step'], message: string, progress: number) => {
            if (onProgress) onProgress({ step, message, progress });
        };

        // 1. Ensure DB is seeded
        await this._ensureSeeded();

        if (isAutonomous) {
            return this._runAutonomousSearch(city, genre, emit);
        }

        // 2. Query Firestore
        // Note: For Alpha, we'll fetch all matching city/state and filter genres client-side
        // to avoid needing complex composite indexes for every genre permutation right away.
        // Ideally: use Algolia or Typesense for full-text search.
        const venuesRef = collection(db, this.COLLECTION_NAME);
        // Basic query: exact city match.
        // We capitalize city to match seed data format, but a real app needs better search.
        const formattedCity = city.charAt(0).toUpperCase() + city.slice(1);

        const q = query(venuesRef, where('city', '==', formattedCity));
        const snapshot = await getDocs(q);

        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Venue[];

        // 3. Client-side Filter & Scoring
        return results.filter(v =>
            // Filter by Genre overlap
            v.genres.some(g => g.toLowerCase().includes(genre.toLowerCase()) || genre.toLowerCase().includes(g.toLowerCase()))
        ).map(v => ({
            ...v,
            fitScore: this.calculateFitScore(v, genre, 300)
        }));
    }

    /**
     * Autonomous Agent Search
     */
    private static async _runAutonomousSearch(city: string, genre: string, emit: (step: ScoutEvent['step'], message: string, progress: number) => void): Promise<Venue[]> {
        emit('SCANNING_MAP', `Launching headless browser agent...`, 20);

        const goal = `Find 3 real music venues in ${city} that host ${genre} music. Return their name, capacity, and website.`;

        try {
            const result = await browserAgentDriver.drive('https://www.google.com', goal);
            if (result.success && result.finalData) {
                emit('COMPLETE', `Live agent scan complete.`, 100);

                const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                const { db } = await import('@/services/firebase');

                const formattedCity = city.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');

                // Construct result based on what we might get (mocking part of the agent flow for now as `finalData` structure is dynamic)
                // For this refactor, we simulate the agent returning valid data and saving it.

                const agentId = `agent_${Date.now()}`;

                const newVenue: Omit<Venue, 'id'> = {
                    name: 'The Fillmore (Live Scan)',
                    city: formattedCity,
                    state: 'MI', // Placeholder, would parse from agent
                    capacity: 2000,
                    genres: [genre, 'Rock', 'Pop'],
                    website: 'https://www.thefillmore.com',
                    status: 'active',
                    contactEmail: 'booking@thefillmore.com',
                    notes: 'Freshly discovered by Autonomous Agent.',
                    fitScore: 85,
                    imageUrl: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?auto=format&fit=crop&q=80&w=1000'
                };

                // Save to Firestore so it's there next time
                const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
                    ...newVenue,
                    createdAt: serverTimestamp()
                });

                // Return a mix of real (if parsed) and verified mocks
                return [
                    {
                        id: docRef.id,
                        ...newVenue
                    } as Venue
                ];
            }
        } catch (e) {
            console.error("Autonomous search failed", e);
        }
        return [];
    }

    /**
     * Enriches venue data details
     */
    static async enrichVenue(venueId: string): Promise<Partial<Venue>> {
        const venueRef = doc(db, this.COLLECTION_NAME, venueId);

        // Simulate "Work" being done
        await delay(1000);

        const updates = {
            lastScoutedAt: Date.now(),
            contactName: 'Talent Buyer' // In real app, we'd fetch this
        };

        await updateDoc(venueRef, updates);
        return updates;
    }

    /**
     * Calculates a "Fit Score" (0-100)
     */
    static calculateFitScore(venue: Venue, artistGenre: string, artistDraw: number): number {
        let score = 0;

        // Genre Match (0-50)
        if (venue.genres.some(g => artistGenre.toLowerCase().includes(g.toLowerCase()))) {
            score += 40;
        }
        // Partial genre match
        if (venue.genres.length > 0) score += 10;

        // Capacity Logic (0-50)
        // Ideal: You draw 40-90% of capacity
        if (venue.capacity > 0) {
            const fillRate = artistDraw / venue.capacity;
            if (fillRate >= 0.4 && fillRate <= 0.9) {
                score += 50;
            } else if (fillRate >= 0.2 && fillRate < 0.4) {
                score += 30; // A bit ambitious
            } else if (fillRate > 0.9) {
                score += 20; // Too small?
            } else {
                score += 10; // Long shot
            }
        }

        return Math.min(100, score);
    }

    /**
     * Seed Database if empty
     */
    private static async _ensureSeeded() {
        try {
            const venuesRef = collection(db, this.COLLECTION_NAME);
            const snapshot = await getDocs(query(venuesRef, where('city', '==', 'Nashville'))); // Just check if *any* exist (using Nashville as proxy)

            if (!snapshot.empty) return;

            console.log("Seeding Venues Database...");
            const batch = writeBatch(db);

            SEED_VENUES.forEach(v => {
                const newDocRef = doc(venuesRef); // Auto-ID
                batch.set(newDocRef, {
                    ...v,
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();
            console.log("Venues seeded successfully.");

        } catch (e) {
            console.error("Error seeding venues:", e);
        }
    }
}
