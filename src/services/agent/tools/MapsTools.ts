import { env } from '@/config/env';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

let mapsPromise: Promise<void> | null = null;

// Dynamic loader for Google Maps API
const loadGoogleMaps = (): Promise<void> => {
    if (mapsPromise) return mapsPromise;

    mapsPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error("Browser environment required for Google Maps API"));
            return;
        }

        if ((window as any).google?.maps) {
            resolve();
            return;
        }

        const apiKey = env.googleMapsApiKey;
        if (!apiKey) {
            reject(new Error("Missing Google Maps API Key"));
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
    });

    return mapsPromise;
};

// Tool: Search Places
export const MapsTools: Record<string, AnyToolFunction> = {
    search_places: wrapTool('search_places', async ({ query, type }: { query: string; type?: string }) => {
        await loadGoogleMaps();
        return new Promise((resolve) => {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            const request: google.maps.places.TextSearchRequest = {
                query: query,
            };
            if (type) {
                request.type = type;
            }

            service.textSearch(request, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    const formatted = results.slice(0, 5).map(place => ({
                        name: place.name,
                        address: place.formatted_address,
                        rating: place.rating,
                        place_id: place.place_id,
                        open_now: place.opening_hours?.isOpen(),
                        types: place.types
                    }));
                    resolve({
                        results: formatted,
                        message: `Found ${formatted.length} places for query: ${query}`
                    });
                } else {
                    resolve(toolError(`No places found or error: ${status}`, "MAPS_EMPTY_OR_ERROR"));
                }
            });
        });
    }),

    get_place_details: wrapTool('get_place_details', async ({ place_id }: { place_id: string }) => {
        await loadGoogleMaps();
        return new Promise((resolve) => {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            service.getDetails({
                placeId: place_id,
                fields: ['name', 'formatted_address', 'formatted_phone_number', 'rating', 'website', 'reviews', 'opening_hours']
            }, (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                    resolve({
                        name: place.name,
                        address: place.formatted_address,
                        phone: place.formatted_phone_number,
                        website: place.website,
                        rating: place.rating,
                        reviews: place.reviews?.slice(0, 3).map(r => ({ author: r.author_name, text: r.text, rating: r.rating })),
                        hours: place.opening_hours?.weekday_text,
                        message: `Details retrieved for ${place.name}.`
                    });
                } else {
                    resolve(toolError(`Place details failed: ${status}`, "MAPS_DETAILS_FAILED"));
                }
            });
        });
    }),

    get_distance_matrix: wrapTool('get_distance_matrix', async ({ origins, destinations }: { origins: string[]; destinations: string[] }) => {
        await loadGoogleMaps();
        return new Promise((resolve) => {
            const service = new google.maps.DistanceMatrixService();
            service.getDistanceMatrix({
                origins,
                destinations,
                travelMode: google.maps.TravelMode.DRIVING,
            }, (response, status) => {
                if (status === google.maps.DistanceMatrixStatus.OK && response) {
                    const results = response.rows.map((row, i) => {
                        return row.elements.map((element, j) => ({
                            origin: origins[i],
                            destination: destinations[j],
                            distance: element.distance?.text,
                            duration: element.duration?.text,
                            status: element.status
                        }));
                    }).flat();
                    resolve({
                        results,
                        message: `Calculated distance matrix for ${origins.length} origins and ${destinations.length} destinations.`
                    });
                } else {
                    resolve(toolError(`Distance Matrix failed: ${status}`, "MAPS_MATRIX_FAILED"));
                }
            });
        });
    })
};
