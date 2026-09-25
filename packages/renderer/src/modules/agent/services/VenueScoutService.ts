import { Venue } from '../schemas';
import { db, auth } from '@/services/firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { VenueSchema, SearchOptionsSchema } from '../schemas';
import { logger } from '@/utils/logger';

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
            if (isAutonomous) {
                throw new Error('Automated public-web venue discovery is unavailable. Review venues manually and verify details on each venue’s website.');
            }

            // Query Firestore
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

            // Update Cache
            if (this.cache.size >= this.MAX_CACHE_SIZE) {
                const oldestKey = this.cache.keys().next().value;
                if (oldestKey) this.cache.delete(oldestKey);
            }
            this.cache.set(cacheKey, { data: processed, timestamp: Date.now() });

            return processed;

        } catch (error: unknown) {
            logger.error('[VenueScoutService] Venue search failed:', error);
            throw error instanceof Error
                ? error
                : new Error(`Venue search failed: ${String(error)}`);
        }
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
     * Enriches venue data details
     */
    static async enrichVenue(venueId: string): Promise<Partial<Venue>> {
        try {
            const venueRef = doc(db, this.COLLECTION_NAME, venueId);
            const updates = { lastScoutedAt: Date.now() };
            await updateDoc(venueRef, updates);
            return updates;
        } catch (e: unknown) {
            logger.error("Failed to enrich venue", e);
            throw e instanceof Error ? e : new Error(`Failed to enrich venue: ${String(e)}`);
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

}
