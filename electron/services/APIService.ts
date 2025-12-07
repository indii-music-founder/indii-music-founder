
interface SongMetadata {
    id: string;
    artist: string;
    title: string;
    album?: string;
    splits?: Record<string, number>;
}

export class APIService {
    // Mock database for now - in production this would fetch from Firestore REST API
    private mockDb: Record<string, SongMetadata> = {
        // Hash for "tech-house-loop.mp3" (we'll need to capture the real hash to test this)
        'a3f...': {
            id: 'demo-1',
            artist: 'Indii Demo',
            title: 'Tech House Loop',
            album: 'Indii O.S. Vol 1',
            splits: { 'producer@indii.os': 50, 'artist@indii.os': 50 }
        }
    };

    async getSongMetadata(hash: string, token?: string): Promise<SongMetadata | null> {
        console.log(`[APIService] Looking up metadata for hash: ${hash}`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // In a real app, use the token to query Firestore:
        /*
        const url = `https://firestore.googleapis.com/v1/projects/indiios-v-1-1/databases/(default)/documents/songs?where=hash=${hash}`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        */

        // For Phase 4, return mock if found, or null
        const result = this.mockDb[hash]; // Precise match

        // Loose match for demo purposes if we don't have the exact hash
        if (!result && hash) {
            console.log("[APIService] Hash not found in mock DB. Returning null.");
            return null;
        }

        return result || null;
    }
}

export const apiService = new APIService();
