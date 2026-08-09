import type { Itinerary, ItineraryStop } from './types';
import type { MileageTripInput } from '@/services/finance/FinanceCompiler';

/**
 * Convert itinerary stops to MileageTripInputs for finance tracking.
 * Each leg of the tour becomes a separate mileage entry.
 */
export function itineraryToMileageTrips(
  itinerary: Itinerary,
  userId: string,
  mileageRate: number,
  tourId?: string
): MileageTripInput[] {
  if (!itinerary.stops || itinerary.stops.length === 0) {
    return [];
  }

  return itinerary.stops
    .filter((stop): stop is ItineraryStop & { distance: number } => stop.distance != null && stop.distance > 0)
    .map((stop, index) => ({
      userId,
      miles: Math.round(stop.distance),
      mileageRate,
      purpose: `${stop.city} - ${stop.venue || 'Tour stop'}`,
      tourId,
      reimbursable: false,
      notes: `Leg ${index + 1} of ${itinerary.tourName}`,
    }));
}

/**
 * Total only explicit, recorded leg distances. The human-readable
 * totalDistance field can describe estimates or straight-line drafts and is
 * therefore not financial or odometer evidence.
 */
export function getTotalMilesFromItinerary(itinerary: Itinerary | null): number {
  if (!itinerary?.stops.length) return 0;
  const total = itinerary.stops.reduce((miles, stop) => (
    typeof stop.distance === 'number' && Number.isFinite(stop.distance) && stop.distance > 0
      ? miles + stop.distance
      : miles
  ), 0);
  return Math.round(total * 100) / 100;
}
