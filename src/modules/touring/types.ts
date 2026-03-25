/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
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
    meta?: any;
}
