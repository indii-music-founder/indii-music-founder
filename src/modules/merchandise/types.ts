export interface MerchProduct {
    id: string; // Firestore ID
    title: string;
    price: string; // Keep as string for display like "$24.99", or number if we want math
    image: string;
    tags?: string[]; // For standard
    features?: string[]; // For pro
    category: 'standard' | 'pro';
    userId: string;
    createdAt?: any; // Firestore Timestamp
}
