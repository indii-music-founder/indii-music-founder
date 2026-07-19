/**
 * useTourGeo — React hook for TourGeoService state subscription.
 * Provides reactive access to geo state across Road Manager components.
 */

import { useEffect, useState } from 'react';
import { tourGeoService } from '../services/TourGeoService';
import type { Itinerary, ItineraryStop, NearbyPlace, FuelLogistics } from '../types';

export function useTourGeo() {
    const [geoState, setGeoState] = useState(tourGeoService.getState());

    useEffect(() => {
        const unsubscribe = tourGeoService.subscribe(setGeoState);
        return unsubscribe;
    }, []);

    return {
        // State
        currentLocation: geoState.currentLocation,
        currentCoordinates: geoState.currentCoordinates,
        nearbyPlaces: geoState.nearbyPlaces,
        selectedPlace: geoState.selectedPlace,
        fuelLogistics: geoState.fuelLogistics,
        isSearching: geoState.isSearching,
        error: geoState.error,

        // Actions
        initializeFromStop: (stop: ItineraryStop) => tourGeoService.initializeFromStop(stop),
        calculateRouteMetrics: (itinerary: Itinerary) => tourGeoService.calculateRouteMetrics(itinerary),
        addNearbyPlace: (place: NearbyPlace) => tourGeoService.addNearbyPlace(place),
        clearNearbyPlaces: () => tourGeoService.clearNearbyPlaces(),
        selectPlace: (place: NearbyPlace) => tourGeoService.selectPlace(place),
        setFuelLogistics: (logistics: FuelLogistics) => tourGeoService.setFuelLogistics(logistics),
        reset: () => tourGeoService.reset(),
    };
}
