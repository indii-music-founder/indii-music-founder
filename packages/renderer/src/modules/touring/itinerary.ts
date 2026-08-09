import type { Itinerary, ItineraryStop } from './types';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export const parseTouringDate = (value: string): Date => {
    const match = DATE_ONLY_PATTERN.exec(value);
    if (!match) return new Date(value);

    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
};

export const formatTouringDate = (value: string, options?: Intl.DateTimeFormatOptions): string => {
    const date = parseTouringDate(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', options);
};
