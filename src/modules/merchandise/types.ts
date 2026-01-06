import { Timestamp, FieldValue } from 'firebase/firestore';

export type ProductType = 'T-Shirt' | 'Hoodie' | 'Mug' | 'Bottle' | 'Poster' | 'Phone Screen';

export interface MerchProduct {
    id: string;
    userId: string;
    title: string;
    image: string;
    price: string;
    category: 'standard' | 'pro';
    tags?: string[];
    features?: string[];
    createdAt?: Timestamp | Date | FieldValue | null;
}

export interface MerchandiseStats {
    totalRevenue: number;
    revenueChange: number;
    unitsSold: number;
    unitsChange: number;
    conversionRate: number;
    ripenessScore: number; // New metric
    peelPerformance: number; // New metric
}
