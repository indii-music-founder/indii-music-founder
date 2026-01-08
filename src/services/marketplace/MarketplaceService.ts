import { db } from '@/services/firebase';
import {
    collection,
    addDoc,
    doc,
    getDoc,
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

    // ⚡ Bolt Optimization: Simple in-memory cache to prevent N+1 reads in feeds
    // Using a Map with a size limit to prevent memory leaks
    private static productCache = new Map<string, { product: Product | null, timestamp: number }>();
    private static CACHE_DURATION = 1000 * 60 * 5; // 5 minutes
    private static MAX_CACHE_SIZE = 100;

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

        // No need to cache immediately as it might not be fully consistent yet
        return docRef.id;
    }

    /**
     * Get a single product by ID.
     * ⚡ Bolt Optimization: Direct document lookup is O(1) vs O(N) collection scan.
     * ⚡ Bolt Optimization: Added caching with size limit to deduplicate requests.
     */
    static async getProductById(productId: string): Promise<Product | null> {
        // Check cache
        const cached = this.productCache.get(productId);
        if (cached) {
            if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.product;
            } else {
                this.productCache.delete(productId);
            }
        }

        try {
            const docRef = doc(db, this.PRODUCTS_COLLECTION, productId);
            const docSnap = await getDoc(docRef);

            let product: Product | null = null;
            if (docSnap.exists()) {
                const data = docSnap.data();
                product = {
                    id: docSnap.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString()
                } as Product;
            }

            // Update cache (Simple LRU: delete if full to make space)
            if (this.productCache.size >= this.MAX_CACHE_SIZE) {
                // Remove the oldest inserted item (first key)
                const firstKey = this.productCache.keys().next().value;
                if (firstKey) this.productCache.delete(firstKey);
            }

            this.productCache.set(productId, { product, timestamp: Date.now() });
            return product;
        } catch (error) {
            console.error(`Failed to fetch product ${productId}:`, error);
            return null;
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
            // @ts-expect-error seedDatabase might be missing in some versions
            if (typeof this.seedDatabase === 'function') {
                // @ts-expect-error seedDatabase might be missing in some versions
                await this.seedDatabase(artistId);
                return this.getProductsByArtist(artistId); // Recursive call after seeding
            }
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
