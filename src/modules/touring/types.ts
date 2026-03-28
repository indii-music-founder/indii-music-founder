import { Timestamp } from 'firebase/firestore';


export interface ItineraryStop {
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
}

export interface Itinerary {
    id?: string;
    userId: string;
    tourName: string;
    stops: ItineraryStop[];
    totalDistance: string;
    estimatedBudget: string;
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

// Logistics feasibility report returned by the AI logistics check
export interface LogisticsReport {
    isFeasible: boolean;
    issues: string[];
    suggestions: string[];
    summary?: string;
}

