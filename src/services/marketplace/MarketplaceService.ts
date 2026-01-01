import { db } from '@/services/firebase';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { Product, Purchase } from './types';

export class MarketplaceService {
    private static PRODUCTS_COLLECTION = 'products';
    private static PURCHASES_COLLECTION = 'purchases';

    /**
     * Create a new product listing.
     */
    static async createProduct(product: Omit<Product, 'id' | 'createdAt' | 'isActive'>): Promise<string> {
        const productData = {
            ...product,
            createdAt: serverTimestamp(),
            isActive: true
        };

        const docRef = await addDoc(collection(db, this.PRODUCTS_COLLECTION), productData);
        return docRef.id;
    }

    /**
     * Seed initial products for a user.
     */
    static async seedDatabase(userId: string): Promise<void> {
        const { writeBatch, doc } = await import('firebase/firestore');
        const batch = writeBatch(db);
        const initialProducts: Omit<Product, 'id' | 'createdAt' | 'isActive'>[] = [
            {
                sellerId: userId,
                title: 'Debut Album - Digital Download',
                price: 9.99,
                currency: 'USD',
                description: 'Full high-quality MP3/FLAC download.',
                type: 'album',
                inventory: 9999,
                images: ['https://placehold.co/400x400/purple/white?text=Album']
            },
            {
                sellerId: userId,
                title: 'Band T-Shirt',
                price: 24.99,
                currency: 'USD',
                description: '100% Cotton, Black.',
                type: 'merch',
                inventory: 50,
                images: ['https://placehold.co/400x400/black/white?text=T-Shirt']
            }
        ];

        for (const p of initialProducts) {
            const docRef = doc(collection(db, this.PRODUCTS_COLLECTION));
            batch.set(docRef, {
                ...p,
                createdAt: serverTimestamp(),
                isActive: true
            });
        }

        try {
            await batch.commit();
            console.log(`[MarketplaceService] Successfully seeded ${initialProducts.length} products`);
        } catch (error) {
            console.error('[MarketplaceService] Failed to seed database:', error);
            throw error;
        }
    }

    /**
     * Get all active products for a specific artist.
     */
    static async getProductsByArtist(artistId: string): Promise<Product[]> {
        const q = query(
            collection(db, this.PRODUCTS_COLLECTION),
            where('sellerId', '==', artistId),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString()
        } as Product));

        // Auto-seed if empty
        if (results.length === 0) {
            await this.seedDatabase(artistId);
            return this.getProductsByArtist(artistId); // Recursive call after seeding
        }

        return results;
    }

    /**
     * Process a purchase for a product.
     * NOTE: This currently uses MOCK payment logic for the Alpha phase.
     */
    static async purchaseProduct(productId: string, buyerId: string, sellerId: string, amount: number): Promise<string> {
        // 1. Validate Product Availability (Inventory) - Skipped for MVP/Unlimited digital items

        // 2. Process Payment (MOCK)
        const mockTransactionId = `txn_${Math.random().toString(36).substr(2, 9)}`;
        const success = true; // Simulate 100% success rate

        if (!success) {
            throw new Error('Payment failed');
        }

        // 3. Record Purchase
        const purchaseData: Omit<Purchase, 'id'> = {
            buyerId,
            sellerId,
            productId,
            amount,
            currency: 'USD',
            status: 'completed',
            transactionId: mockTransactionId,
            createdAt: new Date().toISOString() // Storing as string for simplicity in Purchase type
        };

        const purchaseRef = await addDoc(collection(db, this.PURCHASES_COLLECTION), purchaseData);

        // 4. Update Inventory (if applicable) and Sales Stats (Social Drops)
        // 4. Update Inventory (if applicable) and Sales Stats (Social Drops)
        // const productRef = doc(db, this.PRODUCTS_COLLECTION, productId);
        // await updateDoc(productRef, { inventory: increment(-1) }); // If we tracked inventory

        // 5. Trigger fulfillment (e.g. grant access to digital asset)
        // This would be handled by a cloud function trigger on the 'purchases' collection

        return purchaseRef.id;
    }


}
