import { Venue } from '../types';

// Mock data for development
const MOCK_VENUES: Venue[] = [
    {
        id: 'venue_1',
        name: 'The Basement East',
        city: 'Nashville',
        state: 'TN',
        capacity: 500,
        genres: ['Indie', 'Rock', 'Alternative'],
        website: 'https://thebasementnashville.com',
        status: 'active',
        contactEmail: 'booking@thebasementnashville.com',
        notes: 'Great spot for emerging indie bands.'
    },
    {
        id: 'venue_2',
        name: 'Exit/In',
        city: 'Nashville',
        state: 'TN',
        capacity: 400,
        genres: ['Rock', 'Punk', 'Alternative'],
        website: 'https://exitin.com',
        status: 'active',
        contactEmail: 'booking@exitin.com'
    },
    {
        id: 'venue_3',
        name: 'Mercury Lounge',
        city: 'New York',
        state: 'NY',
        capacity: 250,
        genres: ['Indie', 'Pop', 'Electronic'],
        website: 'https://mercuryeastpresents.com/mercurylounge',
        status: 'active'
    },
    {
        id: 'venue_4',
        name: 'Baby\'s All Right',
        city: 'Brooklyn',
        state: 'NY',
        capacity: 280,
        genres: ['Indie', 'Alternative', 'Hip Hop'],
        status: 'active'
    }
];

export class VenueScoutService {
    /**
     * Searches for venues in a specific city matching the genre.
     * Simulates a network delay and returns mock data.
     */
    static async searchVenues(city: string, genre: string): Promise<Venue[]> {
        console.log(`[VenueScout] Scanning likely venues in ${city} for ${genre}...`);

        // Simulate AI "thinking" / searching time
        await new Promise(resolve => setTimeout(resolve, 1500));

        const matches = MOCK_VENUES.filter(v =>
            v.city.toLowerCase() === city.toLowerCase() &&
            v.genres.some(g => g.toLowerCase().includes(genre.toLowerCase()) || genre.toLowerCase().includes(g.toLowerCase()))
        );

        return matches;
    }

    /**
     * Enriches venue data by looking up contact info.
     * In a real app, this would use the Scraping Agent.
     */
    static async enrichVenue(venueId: string): Promise<Partial<Venue>> {
        console.log(`[VenueScout] enriching data for ${venueId}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            lastScoutedAt: Date.now(),
            contactName: 'Talent Buyer'
        };
    }

    /**
     * Calculates a "Fit Score" (0-100) for how well a venue matches an artist.
     */
    static calculateFitScore(venue: Venue, artistGenre: string, artistDraw: number): number {
        let score = 0;

        // Genre Match
        if (venue.genres.some(g => artistGenre.toLowerCase().includes(g.toLowerCase()))) {
            score += 40;
        }

        // Capacity Logic: Best to pursue venues where you fill 50-80% of room
        const fillRate = artistDraw / venue.capacity;
        if (fillRate >= 0.3 && fillRate <= 1.0) {
            score += 50;
        } else if (fillRate < 0.3) {
            score += 10; // Too big
        } else {
            score += 20; // Too small
        }

        return score;
    }
}
