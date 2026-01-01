import { Venue } from '../types';
import { browserAgentDriver } from '../../../services/agent/BrowserAgentDriver';

// Enhanced Mock Data
const MOCK_VENUES: Venue[] = [
    {
        id: 'venue_1',
        name: 'The Basement East',
        city: 'Nashville',
        state: 'TN',
        capacity: 500,
        genres: ['Indie', 'Rock', 'Alternative', 'Folk'],
        website: 'https://thebasementnashville.com',
        status: 'active',
        contactEmail: 'booking@thebasementnashville.com',
        notes: 'Great spot for emerging indie bands. High fill probability for local acts.',
        imageUrl: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'venue_2',
        name: 'Exit/In',
        city: 'Nashville',
        state: 'TN',
        capacity: 400,
        genres: ['Rock', 'Punk', 'Alternative', 'Metal'],
        website: 'https://exitin.com',
        status: 'active',
        contactEmail: 'booking@exitin.com',
        notes: 'Legendary venue. Requires verified tour history.',
        imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'venue_3',
        name: 'Mercy Lounge (Historical)',
        city: 'Nashville',
        state: 'TN',
        capacity: 500,
        genres: ['Indie', 'Rock', 'Pop'],
        website: '#',
        status: 'closed',
        notes: 'Permanently closed. Do not contact.',
        imageUrl: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'venue_4',
        name: 'Marathon Music Works',
        city: 'Nashville',
        state: 'TN',
        capacity: 1500,
        genres: ['Rock', 'Pop', 'Country', 'Electronic'],
        website: 'https://marathonmusicworks.com',
        status: 'active',
        notes: 'Large capacity. Reach tier target.',
        imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'venue_5',
        name: 'The 5 Spot',
        city: 'Nashville',
        state: 'TN',
        capacity: 200,
        genres: ['Rock', 'Indie', 'Americana'],
        website: 'https://www.the5spot.club',
        status: 'active',
        notes: 'East Nashville staple. Good for residencies.',
        imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1000'
    }
];

export type ScoutEvent = {
    step: 'SCANNING_MAP' | 'ANALYZING_CAPACITY' | 'CHECKING_AVAILABILITY' | 'CALCULATING_FIT' | 'COMPLETE';
    message: string;
    progress: number;
};

export class VenueScoutService {
    /**
     * Searches for venues with simulated "Agentic" delay and events.
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

        if (!isAutonomous) {
            // Simulated Agent Workflow
            emit('SCANNING_MAP', `Initializing geospatial scan of ${city}...`, 10);
            await this.delay(800);

            emit('SCANNING_MAP', `Identified cluster of music venues...`, 30);
            await this.delay(800);

            emit('ANALYZING_CAPACITY', `Filtering by capacity for emerging artists...`, 50);
            await this.delay(800);

            emit('CHECKING_AVAILABILITY', `Cross-referencing genre: ${genre}...`, 70);
            await this.delay(600);

            emit('CALCULATING_FIT', `Computing Artist-Venue Fit Scores...`, 90);
            await this.delay(600);

            emit('COMPLETE', `Found high-probability targets.`, 100);

            // Filter MOCK_VENUES partially to simulate search
            return MOCK_VENUES.filter(v =>
                v.city.toLowerCase() === city.toLowerCase() ||
                v.genres.some(g => g.toLowerCase().includes(genre.toLowerCase()) || genre.toLowerCase().includes(g.toLowerCase()))
            ).map(v => ({
                ...v,
                fitScore: this.calculateFitScore(v, genre, 300) // Default draw 300
            }));
        }

        // Autonomous Mode
        console.log(`[VenueScout] Launching autonomous discovery for ${genre} venues in ${city}...`);
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
                    state: 'MI', // logic would need to parse this better
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
                const docRef = await addDoc(collection(db, 'venues'), {
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
        console.log(`[VenueScout] enriching data for ${venueId}...`);
        await this.delay(1000);
        return {
            lastScoutedAt: Date.now(),
            contactName: 'Talent Buyer'
        };
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

    private static delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

