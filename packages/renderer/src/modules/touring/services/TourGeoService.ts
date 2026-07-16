/**
 * TourGeoService — Consolidates map, places, and routing state for Road Manager.
 * ISSUE-704: Centralizes location tracking, distance calculation, and place finding
 * across all Road Manager tabs (Plan, Tour Book, On the Road, Insights).
 */

import { Itinerary, ItineraryStop, NearbyPlace, FuelLogistics } from '../types';
import { logger } from '@/utils/logger';

interface GeoState {
    currentLocation: string;
    currentCoordinates?: { lat: number; lng: number };
    nearbyPlaces: NearbyPlace[];
    selectedPlace?: NearbyPlace;
    fuelLogistics?: FuelLogistics;
    isSearching: boolean;
    error?: string;
}

interface RouteMetrics {
    totalDistance: number;
    estimatedDuration: string;
    segmentDistances: Array<{ from: string; to: string; distance: number }>;
}

export class TourGeoService {
    private state: GeoState = {
        currentLocation: '',
        nearbyPlaces: [],
        isSearching: false,
    };

    private listeners: Array<(state: GeoState) => void> = [];

    setState(updates: Partial<GeoState>) {
        this.state = { ...this.state, ...updates };
        this.notifyListeners();
    }

    getState(): GeoState {
        return { ...this.state };
    }

    subscribe(listener: (state: GeoState) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.getState()));
    }

    /**
     * Initialize location search from itinerary stop
     */
    async initializeFromStop(stop: ItineraryStop) {
        const locationString = `${stop.city}, ${stop.venue || ''}`;
        this.setState({
            currentLocation: locationString,
            nearbyPlaces: [],
            isSearching: true,
        });

        try {
            // In real implementation, would call Maps API to geocode location
            // For now, store the coordinates from the stop if available
            if (stop.coordinates) {
                this.setState({
                    currentCoordinates: stop.coordinates,
                });
            }
            this.setState({ isSearching: false });
        } catch (err) {
            logger.error('Failed to initialize from stop:', err);
            this.setState({
                isSearching: false,
                error: 'Failed to load location',
            });
        }
    }

    /**
     * Calculate route metrics between stops
     */
    calculateRouteMetrics(itinerary: Itinerary): RouteMetrics {
        const segments = [];
        let totalDistance = 0;

        for (let i = 0; i < itinerary.stops.length - 1; i++) {
            const from = itinerary.stops[i];
            const to = itinerary.stops[i + 1];
            const distance = from.distance || 0;
            totalDistance += distance;

            segments.push({
                from: `${from.city} (${from.venue})`,
                to: `${to.city} (${to.venue})`,
                distance,
            });
        }

        // Estimate duration: ~55 mph average for touring
        const estHours = totalDistance / 55;
        const hours = Math.floor(estHours);
        const minutes = Math.round((estHours - hours) * 60);
        const estimatedDuration = `${hours}h ${minutes}m`;

        return {
            totalDistance,
            estimatedDuration,
            segmentDistances: segments,
        };
    }

    /**
     * Add nearby place to cache for current location
     */
    addNearbyPlace(place: NearbyPlace) {
        this.setState({
            nearbyPlaces: [...this.state.nearbyPlaces, place],
        });
    }

    /**
     * Clear all nearby places
     */
    clearNearbyPlaces() {
        this.setState({
            nearbyPlaces: [],
            selectedPlace: undefined,
        });
    }

    /**
     * Select a nearby place (e.g., for fuel stop)
     */
    selectPlace(place: NearbyPlace) {
        this.setState({
            selectedPlace: place,
        });
    }

    /**
     * Update fuel logistics estimate
     */
    setFuelLogistics(logistics: FuelLogistics) {
        this.setState({ fuelLogistics: logistics });
    }

    /**
     * Reset geo state for new tour
     */
    reset() {
        this.setState({
            currentLocation: '',
            currentCoordinates: undefined,
            nearbyPlaces: [],
            selectedPlace: undefined,
            fuelLogistics: undefined,
            isSearching: false,
            error: undefined,
        });
    }
}

export const tourGeoService = new TourGeoService();
