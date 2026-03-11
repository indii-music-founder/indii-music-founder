import { env } from '@/config/env';
import { logger } from '@/utils/logger';

// ============================================================================
// NearbyPlacesService — Direct Google Places API queries for RoadMode
// ============================================================================
// Provides instant nearby search results for quick actions (gas, food, etc.)
// without routing through the agent. Uses the Google Maps JavaScript API.

export interface NearbyPlace {
    name: string;
    address: string;
    rating: number | null;
    totalRatings: number;
    isOpen: boolean | null;
    placeId: string;
    distanceMeters: number | null;
    distanceText: string | null;
    lat: number;
    lng: number;
    icon: string | null;
}

export interface NearbySearchResult {
    places: NearbyPlace[];
    query: string;
    locationText: string;
}

// Map quick action IDs to Google Places types and search queries
const ACTION_SEARCH_CONFIG: Record<string, { types: string[]; query: string; radius: number }> = {
    gas: {
        types: ['gas_station'],
        query: 'gas station',
        radius: 8000, // 5 miles
    },
    food: {
        types: ['restaurant'],
        query: 'restaurant',
        radius: 5000,
    },
    restroom: {
        types: ['gas_station', 'restaurant'],
        query: 'restroom bathroom nearby',
        radius: 3000,
    },
    lodging: {
        types: ['lodging'],
        query: 'hotel motel',
        radius: 16000, // 10 miles
    },
    emergency: {
        types: ['hospital'],
        query: 'hospital emergency room',
        radius: 16000,
    },
};

let mapsLoadPromise: Promise<void> | null = null;

/**
 * Dynamically load the Google Maps JavaScript API with Places library.
 * Reuses the loader from MapsTools pattern.
 */
const ensureGoogleMapsLoaded = (): Promise<void> => {
    if (mapsLoadPromise) return mapsLoadPromise;

    mapsLoadPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('Browser environment required for Google Maps API'));
            return;
        }

        // Already loaded (e.g., by TourMap)
        if ((window as any).google?.maps?.places) {
            resolve();
            return;
        }

        // Maps loaded but Places not available — wait for it
        if ((window as any).google?.maps) {
            // Places might load shortly, give it a beat
            setTimeout(() => {
                if ((window as any).google?.maps?.places) {
                    resolve();
                } else {
                    // Need to reload with places library
                    loadScript(resolve, reject);
                }
            }, 500);
            return;
        }

        loadScript(resolve, reject);
    });

    return mapsLoadPromise;
};

function loadScript(resolve: () => void, reject: (err: unknown) => void): void {
    const apiKey = env.googleMapsApiKey;
    if (!apiKey) {
        reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY — cannot search nearby places'));
        return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (err) => reject(err));
        return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
}

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Format distance in meters to a human-readable string (miles for US).
 */
function formatDistance(meters: number): string {
    const miles = meters / 1609.344;
    if (miles < 0.1) {
        const feet = Math.round(meters * 3.28084);
        return `${feet} ft`;
    }
    return `${miles.toFixed(1)} mi`;
}

/**
 * Search for nearby places using the Google Maps Places API.
 *
 * @param actionId  The quick action ID from RoadMode (e.g., 'gas', 'food')
 * @param lat       Current latitude
 * @param lng       Current longitude
 * @returns         Structured search results sorted by distance
 */
export async function searchNearbyPlaces(
    actionId: string,
    lat: number,
    lng: number
): Promise<NearbySearchResult> {
    const config = ACTION_SEARCH_CONFIG[actionId];
    if (!config) {
        throw new Error(`Unknown quick action type: ${actionId}`);
    }

    await ensureGoogleMapsLoaded();

    const location = new google.maps.LatLng(lat, lng);

    return new Promise((resolve, reject) => {
        const service = new google.maps.places.PlacesService(document.createElement('div'));

        const request: google.maps.places.PlaceSearchRequest = {
            location,
            radius: config.radius,
            type: config.types[0], // Primary type
            rankBy: google.maps.places.RankBy.PROMINENCE,
        };

        service.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                const places: NearbyPlace[] = results
                    .filter((p) => p.geometry?.location)
                    .map((place) => {
                        const placeLat = place.geometry!.location!.lat();
                        const placeLng = place.geometry!.location!.lng();
                        const distMeters = haversineDistance(lat, lng, placeLat, placeLng);

                        return {
                            name: place.name || 'Unknown',
                            address: place.vicinity || place.formatted_address || '',
                            rating: place.rating ?? null,
                            totalRatings: place.user_ratings_total || 0,
                            isOpen: place.opening_hours?.isOpen() ?? null,
                            placeId: place.place_id || '',
                            distanceMeters: distMeters,
                            distanceText: formatDistance(distMeters),
                            lat: placeLat,
                            lng: placeLng,
                            icon: place.icon || null,
                        };
                    })
                    // Sort by distance (closest first)
                    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
                    // Top 6 results
                    .slice(0, 6);

                logger.info(`[NearbyPlaces] Found ${places.length} results for "${actionId}" near ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

                resolve({
                    places,
                    query: config.query,
                    locationText: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                });
            } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                logger.warn(`[NearbyPlaces] No results for "${actionId}"`);
                resolve({ places: [], query: config.query, locationText: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
            } else {
                logger.error(`[NearbyPlaces] Search failed with status: ${status}`);
                reject(new Error(`Places search failed: ${status}`));
            }
        });
    });
}

/**
 * Open navigation to a place using Google Maps on the device.
 * Falls back to Apple Maps on iOS or opens Google Maps directions in browser.
 */
export function navigateToPlace(place: NearbyPlace): void {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&destination_place_id=${place.placeId}&travelmode=driving`;
    window.open(url, '_blank');
}
