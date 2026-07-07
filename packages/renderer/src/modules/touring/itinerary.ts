import type { Itinerary, ItineraryStop } from './types';

export const createTouringStopId = () => {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID) {
        return cryptoApi.randomUUID();
    }

    return `stop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const normalizeItineraryStop = (stop: ItineraryStop): ItineraryStop => ({
    ...stop,
    id: stop.id ?? createTouringStopId(),
});

export const normalizeItinerary = (itinerary: Itinerary): Itinerary => ({
    ...itinerary,
    stops: itinerary.stops.map(normalizeItineraryStop),
});
