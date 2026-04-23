import { logger } from '@/utils/logger';

export interface GeocodeResult {
    lat: number;
    lng: number;
    state?: string;
    city?: string;
}

const cache = new Map<string, GeocodeResult>();

// Adding a slight delay to respect Nominatim rate limit (1 req/sec)
let lastRequestTime = 0;

export async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
    const cacheKey = location.toLowerCase().trim();
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!;
    }

    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < 1100) {
        await new Promise(resolve => setTimeout(resolve, 1100 - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    try {
        const query = encodeURIComponent(location);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`, {
            headers: {
                'User-Agent': 'indiiOS-App/1.0 (contact@thewalkingagency.com)'
            }
        });

        if (!res.ok) throw new Error(`Geocode failed: ${res.statusText}`);

        const data = await res.json();
        if (data && data.length > 0) {
            const result: GeocodeResult = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                state: data[0].address?.state,
                city: data[0].address?.city || data[0].address?.town || data[0].address?.village || data[0].name
            };
            cache.set(cacheKey, result);
            return result;
        }
        return null;
    } catch (err) {
        logger.error('Geocoding error:', err);
        return null;
    }
}
