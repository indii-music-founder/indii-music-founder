
interface SongMetadata {
    id: string;
    artist: string;
    title: string;
    album?: string;
    splits?: Record<string, number>;
}

export class APIService {
    async getSongMetadata(hash: string, token?: string): Promise<SongMetadata | null> {
        console.log(`[APIService] Looking up metadata for hash: ${hash}`);

        const lookupUrl = process.env.METADATA_LOOKUP_URL;
        if (!lookupUrl) {
            console.warn('[APIService] METADATA_LOOKUP_URL is not configured; metadata lookup disabled.');
            return null;
        }

        const url = new URL(lookupUrl);
        url.searchParams.set('hash', hash);

        const response = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            signal: AbortSignal.timeout(10000),
        });

        if (response.status === 404) return null;
        if (!response.ok) {
            throw new Error(`Metadata lookup failed: ${response.status} ${response.statusText}`);
        }

        return await response.json() as SongMetadata;
    }
}

export const apiService = new APIService();
