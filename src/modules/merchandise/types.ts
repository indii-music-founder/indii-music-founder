import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase/firestore';

export type ProductType = 'T-Shirt' | 'Hoodie' | 'Mug' | 'Bottle' | 'Poster' | 'Phone Screen';

export const PRODUCT_TYPE_MAPPING: Record<string, ProductType> = {
    't-shirt': 'T-Shirt',
    'hoodie': 'Hoodie',
    'mug': 'Mug',
    'bottle': 'Bottle',
    'poster': 'Poster',
    'phone': 'Phone Screen'
};

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

// Zod Schemas for Validation
export const MockupGenerationSchema = z.object({
    id: z.string().optional(),
    userId: z.string(),
    asset: z.string(),
    type: z.string(),
    scene: z.string(),
    resultUrl: z.string().url().optional(),
    status: z.enum(['processing', 'completed', 'failed']),
    createdAt: z.any() // Firestore Timestamp
});

export const VideoGenerationSchema = z.object({
    id: z.string().optional(),
    userId: z.string(),
    mockupUrl: z.string().url(),
    motion: z.string(),
    resultUrl: z.string().url().optional(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']),
    createdAt: z.any() // Firestore Timestamp
});

export const CatalogProductSchema = z.object({
    id: z.string(),
    title: z.string(),
    basePrice: z.number(),
    image: z.string().url(),
    tags: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    category: z.enum(['standard', 'pro']),
    description: z.string().optional()
});

export const ManufactureRequestSchema = z.object({
    productId: z.string(),
    variantId: z.string(),
    quantity: z.number().min(1),
    userId: z.string().optional(),
    status: z.enum(['pending', 'processing', 'completed']).optional(),
    orderId: z.string().optional(),
    createdAt: z.any().optional()
});

export const SampleRequestSchema = z.object({
    productId: z.string(),
    variantId: z.string(),
    shippingAddress: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string()
    }),
    userId: z.string().optional(),
    status: z.enum(['pending', 'processing', 'shipped', 'delivered']).optional(),
    requestId: z.string().optional(),
    createdAt: z.any().optional()
});

export type MockupGeneration = z.infer<typeof MockupGenerationSchema>;
export type VideoGeneration = z.infer<typeof VideoGenerationSchema>;
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;
export type ManufactureRequest = z.infer<typeof ManufactureRequestSchema>;
export type SampleRequest = z.infer<typeof SampleRequestSchema>;
