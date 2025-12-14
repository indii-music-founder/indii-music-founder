// Type declarations for Google Maps JavaScript API
// Minimal declarations to support MapsComponent.tsx

declare global {
    interface Window {
        google: typeof google;
    }

    namespace google.maps {
        interface LatLngLiteral {
            lat: number;
            lng: number;
        }

        interface MapOptions {
            center?: LatLngLiteral;
            zoom?: number;
            styles?: MapTypeStyle[];
        }

        interface MapTypeStyle {
            elementType?: string;
            featureType?: string;
            stylers?: { [key: string]: string }[];
        }

        class Map {
            constructor(mapDiv: HTMLElement, opts?: MapOptions);
            setCenter(center: LatLngLiteral): void;
            setZoom(zoom: number): void;
        }

        interface MarkerOptions {
            position?: LatLngLiteral;
            map?: Map;
            title?: string;
        }

        class Marker {
            constructor(opts?: MarkerOptions);
        }

        // Places Service
        namespace places {
            class PlacesService {
                constructor(attrContainer: HTMLElement | Map);
                textSearch(request: TextSearchRequest, callback: (results: PlaceResult[] | null, status: PlacesServiceStatus) => void): void;
                getDetails(request: PlaceDetailsRequest, callback: (result: PlaceResult | null, status: PlacesServiceStatus) => void): void;
            }

            interface TextSearchRequest {
                query: string;
                type?: string;
            }

            interface PlaceDetailsRequest {
                placeId: string;
                fields?: string[];
            }

            enum PlacesServiceStatus {
                OK = 'OK',
                ZERO_RESULTS = 'ZERO_RESULTS',
                INVALID_REQUEST = 'INVALID_REQUEST',
                OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
                REQUEST_DENIED = 'REQUEST_DENIED',
                UNKNOWN_ERROR = 'UNKNOWN_ERROR'
            }

            interface PlaceResult {
                name?: string;
                formatted_address?: string;
                formatted_phone_number?: string;
                rating?: number;
                place_id?: string;
                website?: string;
                opening_hours?: {
                    isOpen(date?: Date): boolean;
                    weekday_text?: string[];
                };
                types?: string[];
                reviews?: PlaceReview[];
            }

            interface PlaceReview {
                author_name: string;
                text: string;
                rating: number;
            }
        }

        // Distance Matrix Service
        class DistanceMatrixService {
            getDistanceMatrix(request: DistanceMatrixRequest, callback: (response: DistanceMatrixResponse | null, status: DistanceMatrixStatus) => void): void;
        }

        interface DistanceMatrixRequest {
            origins: (string | LatLngLiteral)[];
            destinations: (string | LatLngLiteral)[];
            travelMode: TravelMode;
        }

        interface DistanceMatrixResponse {
            originAddresses: string[];
            destinationAddresses: string[];
            rows: DistanceMatrixResponseRow[];
        }

        interface DistanceMatrixResponseRow {
            elements: DistanceMatrixResponseElement[];
        }

        interface DistanceMatrixResponseElement {
            status: DistanceMatrixElementStatus;
            duration: { text: string; value: number };
            distance: { text: string; value: number };
        }

        enum DistanceMatrixStatus {
            OK = 'OK',
            INVALID_REQUEST = 'INVALID_REQUEST',
            MAX_ELEMENTS_EXCEEDED = 'MAX_ELEMENTS_EXCEEDED',
            MAX_DIMENSIONS_EXCEEDED = 'MAX_DIMENSIONS_EXCEEDED',
            OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
            REQUEST_DENIED = 'REQUEST_DENIED',
            UNKNOWN_ERROR = 'UNKNOWN_ERROR'
        }

        enum DistanceMatrixElementStatus {
            OK = 'OK',
            NOT_FOUND = 'NOT_FOUND',
            ZERO_RESULTS = 'ZERO_RESULTS',
        }

        enum TravelMode {
            DRIVING = 'DRIVING',
            BICYCLING = 'BICYCLING',
            TRANSIT = 'TRANSIT',
            WALKING = 'WALKING'
        }
    }
}

export { };
