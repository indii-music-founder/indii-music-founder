export type ProductType = 'song' | 'album' | 'merch' | 'ticket' | 'digital-asset' | 'service' | 'stem-pack';

export type StemLabel = 'drums' | 'bass' | 'melody' | 'vocals';

export interface StemFile {
    label: StemLabel;
    url: string;      // Firebase Storage download URL
    filename: string; // Original filename for display
    storagePath: string; // Full path in Firebase Storage
}

export interface Product {
    id: string;
    sellerId: string;
    title: string;
    description: string;
    price: number; // In cents or base unit
    currency: string;
    type: ProductType;
    images: string[];
    inventory?: number; // Unlimited if undefined
    metadata?: Record<string, unknown>; // For things like ISRC, Ticket Date, stemFiles[], etc.
    splits?: ProductSplit[]; // Revenue splits
    createdAt: string;
    isActive: boolean;
}

export interface ProductSplit {
    recipientId: string;
    role: string;
    percentage: number; // 0-100
    email?: string;
}

export interface Purchase {
    id: string;
    buyerId: string;
    sellerId: string;
    productId: string;
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    transactionId?: string; // Stripe/Payment Gateway ID
    createdAt: string;
}
