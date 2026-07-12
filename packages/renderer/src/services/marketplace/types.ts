export type ProductType = 'song' | 'album' | 'merch' | 'ticket' | 'digital-asset' | 'service' | 'stem-pack';

export type StemLabel = 'drums' | 'bass' | 'melody' | 'vocals';

/**
 * Public preview metadata for a stem — safe to store on the product doc,
 * which is readable by any authenticated user. No storage path, no download
 * URL/token: those are bearer-equivalent capabilities and must never appear
 * in a publicly-readable document (ISSUE-975). See `StemFileManifestEntry`.
 */
export interface StemFile {
    label: StemLabel;
    filename: string; // Original filename for display
}

/**
 * Private manifest entry — storage path for a stem, kept in the
 * write-only/read-never `marketplace_stem_manifests/{productId}` collection.
 * Only the `getStemDownloadUrl` Cloud Function (Admin SDK) ever reads this,
 * after verifying a completed purchase or seller identity.
 */
export interface StemFileManifestEntry extends StemFile {
    storagePath: string;
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
