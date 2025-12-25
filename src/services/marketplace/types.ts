export type ProductType = 'song' | 'album' | 'merch' | 'ticket' | 'digital-asset' | 'service';

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
    metadata?: Record<string, any>; // For things like ISRC, Ticket Date, etc.
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
