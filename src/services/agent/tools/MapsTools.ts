import { env } from '@/config/env';

let mapsPromise: Promise<void> | null = null;

// Dynamic loader for Google Maps API
const loadGoogleMaps = (): Promise<void> => {
    if (mapsPromise) return mapsPromise;

    mapsPromise = new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && (window as any).google?.maps) {
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
export const search_places = async ({ query, type }: { query: string; type?: string }) => {
    await loadGoogleMaps();
    return new Promise<string>((resolve, reject) => {
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        const request: google.maps.places.TextSearchRequest = {
            query: query,
            // type mapping if needed, but query usually sufficient
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
                resolve(JSON.stringify(formatted, null, 2));
            } else {
                resolve(`No places found or error: ${status}`);
            }
        });
    });
};

// Tool: Get Place Details
export const get_place_details = async ({ place_id }: { place_id: string }) => {
    await loadGoogleMaps();
    return new Promise<string>((resolve, reject) => {
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        service.getDetails({
            placeId: place_id,
            fields: ['name', 'formatted_address', 'formatted_phone_number', 'rating', 'website', 'reviews', 'opening_hours']
        }, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                resolve(JSON.stringify({
                    name: place.name,
                    address: place.formatted_address,
                    phone: place.formatted_phone_number,
                    website: place.website,
                    rating: place.rating,
                    reviews: place.reviews?.slice(0, 3).map(r => ({ author: r.author_name, text: r.text, rating: r.rating })),
                    hours: place.opening_hours?.weekday_text
                }, null, 2));
            } else {
                resolve(`Place details failed: ${status}`);
            }
        });
    });
};

// Tool: Get Distance Matrix
export const get_distance_matrix = async ({ origins, destinations }: { origins: string[]; destinations: string[] }) => {
    await loadGoogleMaps();
    return new Promise<string>((resolve, reject) => {
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
            origins,
            destinations,
            travelMode: google.maps.TravelMode.DRIVING,
        }, (response, status) => {
            if (status === google.maps.DistanceMatrixStatus.OK && response) {
                const results = response.rows.map((row, i) => {
                    return row.elements.map((element, j) => ({
                        origin: origins[i], // approximation, Maps API response has originAddresses
                        destination: destinations[j],
                        distance: element.distance.text,
                        duration: element.duration.text,
                        status: element.status
                    }));
                }).flat();
                resolve(JSON.stringify(results, null, 2));
            } else {
                resolve(`Distance Matrix failed: ${status}`);
            }
        });
    });
};

export const MapsTools = {
    search_places,
    get_place_details,
    get_distance_matrix
};
