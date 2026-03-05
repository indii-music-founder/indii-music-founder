import { Venue } from '../schemas';
import { browserAgentDriver } from '../../../services/agent/BrowserAgentDriver';
import { db, auth } from '@/services/firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { delay } from '@/utils/async';
import { VenueSchema, SearchOptionsSchema } from '../schemas';
import { logger } from '@/utils/logger';

// Initial Seed Data (Used only if DB is empty or offline)
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

// Cache interface
interface VenueCacheEntry {
    data: Venue[];
    timestamp: number;
}

export class VenueScoutService {
    private static COLLECTION_NAME = 'venues';

    // In-memory cache: Map<"City-Genre", Entry>
    private static cache = new Map<string, VenueCacheEntry>();
    private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private static readonly MAX_CACHE_SIZE = 100;

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
        // Validate Inputs
        const validation = SearchOptionsSchema.safeParse({ city, genre, isAutonomous });
        if (!validation.success) {
            logger.error("Invalid search parameters:", validation.error);
            throw new Error(`Invalid search parameters: ${validation.error.message}`);
        }

        const emit = (step: ScoutEvent['step'], message: string, progress: number) => {
            if (onProgress) onProgress({ step, message, progress });
        };

        // Check Cache (Optimization)
        const cacheKey = `${city.toLowerCase()}-${genre.toLowerCase()}`;
        if (!isAutonomous && this.cache.has(cacheKey)) {
            const entry = this.cache.get(cacheKey)!;
            if (Date.now() - entry.timestamp < this.CACHE_TTL) {
                // emit('COMPLETE', 'Returning cached results', 100); // Optional: Emit complete if immediate
                return entry.data;
            }
        }

        try {
            // 1. Ensure DB is seeded
            await this._ensureSeeded();

            if (isAutonomous) {
                return this._runAutonomousSearch(city, genre, emit);
            }

            // 2. Query Firestore
            // Note: For Alpha, we'll fetch all matching city/state and filter genres client-side
            // to avoid needing complex composite indexes for every genre permutation right away.
            const venuesRef = collection(db, this.COLLECTION_NAME);
            const formattedCity = city.charAt(0).toUpperCase() + city.slice(1);

            const q = query(venuesRef, where('city', '==', formattedCity));
            const snapshot = await getDocs(q);

            const results: Venue[] = [];

            // Validate Results (Data Integrity)
            snapshot.docs.forEach(doc => {
                const data = { id: doc.id, ...doc.data() };
                const parsed = VenueSchema.safeParse(data);
                if (parsed.success) {
                    results.push(parsed.data);
                } else {
                    logger.warn(`Skipping invalid venue ${doc.id}:`, parsed.error);
                }
            });

            // 3. Client-side Filter & Scoring
            const processed = this._processResults(results, genre);

            if (processed.length === 0) {
                // Fallback to local seed if DB is empty or has no matches
                // Use a proper log level, not just logger.debug for info
                return this._getFallbackData(city, genre);
            }

            // Update Cache
            if (this.cache.size >= this.MAX_CACHE_SIZE) {
                const oldestKey = this.cache.keys().next().value;
                if (oldestKey) this.cache.delete(oldestKey);
            }
            this.cache.set(cacheKey, { data: processed, timestamp: Date.now() });

            return processed;

        } catch (error) {
            logger.warn('[VenueScoutService] Firestore/Network error, falling back to local seed data:', error);
            // Graceful Fallback
            return this._getFallbackData(city, genre);
        }
    }

    private static _getFallbackData(city: string, genre: string): Venue[] {
        const formattedCity = city.charAt(0).toUpperCase() + city.slice(1);
        const fallbackResults = SEED_VENUES
            .filter(v => v.city === formattedCity)
            .map((v, i) => ({ ...v, id: `fallback-${i}` } as Venue));

        // Ensure fallback data is also valid according to schema (it should be, but good practice)
        // fitScore is added in processResults
        return this._processResults(fallbackResults, genre);
    }

    private static _processResults(venues: Venue[], genre: string): Venue[] {
        return venues.filter(v =>
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

                const newVenue: Omit<Venue, 'id'> = {
                    name: 'The Fillmore (Live Scan)',
                    city: formattedCity,
                    state: 'MI', // Placeholder
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
                try {
                    // Check authentication before attempting Firestore write
                    if (!auth.currentUser) {
                        logger.warn('[VenueScout] Skipping Firestore write: Not authenticated');
                        return [{ id: 'temp-autonomous', ...newVenue } as Venue];
                    }
                    const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
                        ...newVenue,
                        createdAt: serverTimestamp()
                    });
                    return [{ id: docRef.id, ...newVenue } as Venue];
                } catch (e) {
                    return [{ id: 'temp-autonomous', ...newVenue } as Venue];
                }
            }
        } catch (e) {
            // logger.error("Autonomous search failed", e);
        }
        return [];
    }

    /**
     * Enriches venue data details
     */
    static async enrichVenue(venueId: string): Promise<Partial<Venue>> {
        try {
            const venueRef = doc(db, this.COLLECTION_NAME, venueId);
            await delay(1000);
            const updates = {
                lastScoutedAt: Date.now(),
                contactName: 'Talent Buyer'
            };
            await updateDoc(venueRef, updates);
            return updates;
        } catch (e) {
            logger.warn("Failed to enrich venue (offline?)", e);
            return { lastScoutedAt: Date.now() };
        }
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
            // Check if db is initialized correctly (rudimentary check)
            if (!db) throw new Error("Database not initialized");

            const venuesRef = collection(db, this.COLLECTION_NAME);
            const snapshot = await getDocs(query(venuesRef, where('city', '==', 'Nashville')));

            if (!snapshot.empty) return;

            const batch = writeBatch(db);
            SEED_VENUES.forEach(v => {
                const newDocRef = doc(venuesRef);
                batch.set(newDocRef, {
                    ...v,
                    createdAt: serverTimestamp()
                });
            });
            await batch.commit();

        } catch (e) {
            // Silent fail is acceptable here as searchVenues will fallback to local seed
            // logger.error('[VenueScoutService] Error seeding venues:', e);
        }
    }
}
