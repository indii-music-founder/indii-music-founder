export interface ItineraryStop {
    date: string;
    city: string;
    venue: string;
    activity: string;
    notes: string;
    type?: string;
    distance?: number;
}

export interface Itinerary {
    id?: string;
    userId: string;
    tourName: string;
    stops: ItineraryStop[];
    totalDistance: string;
    estimatedBudget: string;
    createdAt?: any;
}

export interface VehicleStats {
    id?: string;
    userId: string;
    milesDriven: number;
    fuelLevelPercent: number;
    tankSizeGallons: number;
    mpg: number;
    gasPricePerGallon: number;
    updatedAt?: any;
}

export interface RiderItem {
    id: string;
    userId: string;
    label: string;
    completed: boolean;
    category: 'food' | 'drink' | 'essential';
    createdAt?: any;
    updatedAt?: any;
}
