import { Venue } from '../schemas';
import { browserAgentDriver } from '../../../services/agent/BrowserAgentDriver';
import { db, auth } from '@/services/firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
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
                return this._runAutonomousSearch(city, genre, emit);
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
     * Autonomous Agent Search
     */
    private static async _runAutonomousSearch(city: string, genre: string, emit: (step: ScoutEvent['step'], message: string, progress: number) => void): Promise<Venue[]> {
        emit('SCANNING_MAP', `Launching headless browser agent...`, 20);

        const goal = [
            `Find real music venues in ${city} that host ${genre} music.`,
            'Return only verifiable structured data as JSON:',
            '{"venues":[{"name":"...","city":"...","state":"...","capacity":0,"genres":["..."],"website":"https://...","contactEmail":"","status":"active","notes":"source URL or evidence"}]}',
            'Do not infer missing capacity, contact, website, or status.'
        ].join(' ');

        try {
            const result = await browserAgentDriver.drive('https://www.google.com', goal);
            if (!result.success || !result.finalData) {
                throw new Error(`Autonomous venue scan failed: ${result.logs.join('\n')}`);
            }

            const discovered = this._parseAutonomousVenueData(result.finalData, genre);
            if (discovered.length === 0) {
                throw new Error('Autonomous venue scan returned no valid venue records.');
            }

            if (!auth.currentUser) {
                throw new Error('Authenticated user is required to save autonomous venue scan results.');
            }

            const venues: Venue[] = [];
            for (const venue of discovered) {
                const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
                    ...venue,
                    createdAt: serverTimestamp()
                });
                venues.push({ id: docRef.id, ...venue });
            }

            emit('COMPLETE', `Live agent scan complete.`, 100);
            return venues;
        } catch (_e: unknown) {
            const message = _e instanceof Error ? _e.message : String(_e);
            logger.error('[VenueScoutService] Autonomous search failed:', _e);
            throw new Error(message);
        }
    }

    private static _parseAutonomousVenueData(finalData: unknown, genre: string): Omit<Venue, 'id'>[] {
        let payload = finalData;
        if (typeof payload === 'string') {
            const trimmed = payload.trim();
            if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                throw new Error('Autonomous venue scan returned unstructured text. Refusing to fabricate venue records.');
            }
            try {
                payload = JSON.parse(trimmed) as unknown;
            } catch (error: unknown) {
                throw new Error(`Autonomous venue scan returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        const rawVenues = Array.isArray(payload)
            ? payload
            : typeof payload === 'object' && payload !== null && Array.isArray((payload as { venues?: unknown }).venues)
                ? (payload as { venues: unknown[] }).venues
                : [];

        if (rawVenues.length === 0) {
            throw new Error('Autonomous venue scan did not include a venues array.');
        }

        const parsedVenues: Omit<Venue, 'id'>[] = [];
        const errors: string[] = [];

        rawVenues.forEach((raw, index) => {
            if (typeof raw !== 'object' || raw === null) {
                errors.push(`Venue ${index + 1}: expected object.`);
                return;
            }

            const candidate = raw as Record<string, unknown>;
            const parsed = VenueSchema.safeParse({
                ...candidate,
                id: `autonomous-${index}`,
                status: candidate.status || 'unknown',
                fitScore: 0,
            });

            if (!parsed.success) {
                errors.push(`Venue ${index + 1}: ${parsed.error.message}`);
                return;
            }

            const { id: _id, fitScore: _fitScore, ...venue } = parsed.data;
            parsedVenues.push({
                ...venue,
                fitScore: this.calculateFitScore(parsed.data, genre, 300),
            });
        });

        if (parsedVenues.length === 0) {
            throw new Error(`Autonomous venue scan returned no valid records. ${errors.join(' ')}`);
        }

        return parsedVenues;
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
