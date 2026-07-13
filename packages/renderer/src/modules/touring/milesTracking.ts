import type { Itinerary, ItineraryStop } from './types';
import type { MileageTripInput } from '@/services/finance/FinanceCompiler';

/**
 * Convert itinerary stops to MileageTripInputs for finance tracking.
 * Each leg of the tour becomes a separate mileage entry.
 */
export function itineraryToMileageTrips(
  itinerary: Itinerary,
  userId: string,
  tourId?: string,
  mileageRate: number = 0.67
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
      reimbursable: true,
      notes: `Leg ${index + 1} of ${itinerary.tourName}`,
    }));
}

/**
 * Calculate total miles from itinerary.
 * Parses the stored string format (e.g., "1250 miles")
 */
export function getTotalMilesFromItinerary(itinerary: Itinerary | null): number {
  if (!itinerary?.totalDistance) return 0;
  const match = itinerary.totalDistance.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Calculate total mileage cost at standard IRS rate.
 */
export function calculateMileageCost(miles: number, mileageRate: number = 0.67): number {
  return Math.round(miles * mileageRate * 100) / 100;
}
