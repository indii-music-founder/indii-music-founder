import { Timestamp } from 'firebase/firestore';

/**
 * ISSUE-705 Job 6: Booking Handoff Contract
 * ============================================
 * Booking Agent (agent/types.ts) → Road Manager (touring/types.ts)
 *
 * Booking Agent produces GigOpportunity (status: BOOKED):
 *   - venueId, venue name/city
 *   - proposedDate (timestamp)
 *   - dealType: 'guarantee' | 'door_split' | 'promoter_profit' | 'unknown'
 *   - guaranteeAmount (if applicable)
 *
 * Road Manager consumes via ItineraryStop.bookingId:
 *   - Lookup GigOpportunity by bookingId
 *   - Extract dealType → ItineraryStop.deal_type (enum match required)
 *   - Extract guaranteeAmount → ItineraryStop.guarantee (optional override)
 *   - proposedDate → ItineraryStop.date (YYYY-MM-DD string)
 *   - venueId + name/city → ItineraryStop venue/city fields
 *
 * Data ownership: Road Manager may override guarantee/split/merch after negotiation.
 * Booking Agent can mark GigOpportunity as executed when itinerary.stops contains matching bookingId.
 */

export interface ItineraryStop {
    id?: string;
    date: string;
    city: string;
    venue: string;
    activity: string;
    notes: string;
    type?: string;
    distance?: number;
    // Enhancement: specific coordinates for venues
    coordinates?: {
        lat: number;
        lng: number;
    };
    // Day sheet data (set via DaySheetModal)
    schedule?: Array<{ time: string; event: string }>;
    contacts?: Array<{ role: string; name: string; phone: string }>;
    // Settlement data for finance reconciliation (ISSUE-705 Job 4)
    guarantee?: number;
    door_count?: number;
    split_pct?: number;
    merch_cut?: number;
    // Booking handoff contract (ISSUE-705 Job 6)
    bookingId?: string; // Link to Booking Agent's deal record
    deal_type?: 'guarantee' | 'door_split' | 'promoter_profit' | 'unknown'; // Must match agent/types.ts
}

export interface Itinerary {
    id?: string;
    userId: string;
    tourName: string;
    stops: ItineraryStop[];
    totalDistance: string;
    estimatedBudget?: string;
    createdAt?: Timestamp;
}

export interface VehicleStats {
    id?: string;
    userId: string;
    milesDriven: number;
    fuelLevelPercent: number;
    tankSizeGallons: number;
    mpg: number;
    gasPricePerGallon: number;
    updatedAt?: Timestamp;
}

export interface RiderItem {
    id: string;
    userId: string;
    label: string;
    completed: boolean;
    category: 'food' | 'drink' | 'essential';
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

// Visual Mapping Types
export interface MapMarker {
    position: { lat: number; lng: number };
    title: string;
    type: 'venue' | 'gas' | 'hotel' | 'current' | 'waypoint';
    label?: string;
    meta?: Record<string, unknown>;
}

// Fuel logistics returned by the fuel calculation AI
export interface FuelLogistics {
    currentRangeMiles: number;
    fullTankRangeMiles?: number;
    costToFill: number | string;
    status: 'GOOD' | 'OK' | 'LOW' | 'CRITICAL';
    recommendedStops?: string[];
}


// Google Places nearby result
export interface NearbyPlace {
    name: string;
    vicinity: string;
    isOpen: boolean;
    place_id?: string;
    geometry: {
        location: { lat: number; lng: number };
    };
}

// Logistics feasibility report returned by the Autonomous logistics check
export interface LogisticsReport {
    isFeasible: boolean;
    issues: string[];
    suggestions: string[];
    summary?: string;
}

export interface EmergencyContact {
    id: string;
    userId: string;
    name: string;
    phone: string;
    relationship: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}
