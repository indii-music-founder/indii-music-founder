// ============================================================================
// NearbyPlacesService — backend-only guard for RoadMode place search
// ============================================================================
// Direct browser access to Google Maps/Places is disabled. Place search must be
// implemented through a secured backend proxy before live results are enabled.

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

const ACTION_SEARCH_CONFIG: Record<string, { query: string }> = {
    gas: { query: 'gas station' },
    food: { query: 'restaurant' },
    restroom: { query: 'restroom bathroom nearby' },
    lodging: { query: 'hotel motel' },
    emergency: { query: 'hospital emergency room' },
};

const MAPS_BACKEND_REQUIRED = 'Nearby Places requires a secured backend proxy; browser-side Google Maps/Places access is disabled.';

export async function searchNearbyPlaces(
    actionId: string,
    lat: number,
    lng: number
): Promise<NearbySearchResult> {
    const config = ACTION_SEARCH_CONFIG[actionId];
    if (!config) {
        throw new Error(`Unknown quick action type: ${actionId}`);
    }

    void lat;
    void lng;
    throw new Error(MAPS_BACKEND_REQUIRED);
}

export function navigateToPlace(place: NearbyPlace): void {
    const params = new URLSearchParams({
        api: '1',
        destination: `${place.lat},${place.lng}`,
        travelmode: 'driving',
    });
    if (place.placeId) {
        params.set('destination_place_id', place.placeId);
    }
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank');
}
