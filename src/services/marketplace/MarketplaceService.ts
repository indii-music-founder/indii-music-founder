import { db, storage } from '@/services/firebase';
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
    Timestamp,
    updateDoc,
    increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Product, Purchase, StemFile, StemLabel } from './types';
import { createOneTimePayment } from '@/services/payment/PaymentService';
import { revenueService } from '@/services/RevenueService';
import { logger } from '@/utils/logger';

export class MarketplaceService {
    private static PRODUCTS_COLLECTION = 'products';
    private static PURCHASES_COLLECTION = 'purchases';

    // ⚡ Bolt Optimization: Simple in-memory cache to prevent N+1 reads in feeds
    // Using a Map with a size limit to prevent memory leaks
    private static productCache = new Map<string, { product: Product | null, timestamp: number }>();
    private static CACHE_DURATION = 1000 * 60 * 5; // 5 minutes
    private static MAX_CACHE_SIZE = 100;

    /**
     * Uploads stem files to Firebase Storage and returns StemFile metadata.
     * Call this before createProduct() when type === 'stem-pack'.
     *
     * @param sellerId  - The authenticated user's ID (used for storage path scoping)
     * @param draftId   - A temporary ID generated before the product doc exists
     * @param stems     - Array of { label, file } — one per stem track
     */
    static async uploadStemFiles(
        sellerId: string,
        draftId: string,
        stems: { label: StemLabel; file: File }[]
    ): Promise<StemFile[]> {
        const results = await Promise.all(
            stems.map(async ({ label, file }) => {
                const ext = file.name.split('.').pop() ?? 'mp3';
                const storagePath = `stems/${sellerId}/${draftId}/${label}.${ext}`;
                const storageRef = ref(storage, storagePath);

                await uploadBytes(storageRef, file, {
                    contentType: file.type || 'audio/mpeg',
                    customMetadata: { sellerId, draftId, label },
                });

                const url = await getDownloadURL(storageRef);
                return { label, url, filename: file.name, storagePath } as StemFile;
            })
        );

        logger.info(`[MarketplaceService] Uploaded ${results.length} stems for draft ${draftId}`);
        return results;
    }

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
            logger.error(`Failed to fetch product ${productId}:`, error);
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

        return results;
    }

    /**
     * Deletes a product by marking it as inactive.
     */
    static async deleteProduct(productId: string): Promise<void> {
        try {
            const productRef = doc(db, this.PRODUCTS_COLLECTION, productId);
            await updateDoc(productRef, {
                isActive: false
            });
            // Clear cache
            this.productCache.delete(productId);
        } catch (error) {
            logger.error(`Failed to delete product ${productId}:`, error);
            throw error;
        }
    }

    /**
     * Process a purchase for a product.
     */
    static async purchaseProduct(
        productId: string,
        buyerId: string,
        sellerId: string,
        amount: number,
        source: string = 'direct',
        sourceId?: string
    ): Promise<string> {
        // 1. Validate Product Availability (Inventory)
        const productRef = doc(db, this.PRODUCTS_COLLECTION, productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
            throw new Error('Product not found');
        }

        const productData = productSnap.data() as Product;
        const hasInventoryTracking = typeof productData.inventory === 'number';

        if (hasInventoryTracking && (productData.inventory as number) <= 0) {
            throw new Error('Out of Stock');
        }

        // 1.5 Reserve Inventory (Optimistic Decrement)
        if (hasInventoryTracking) {
            await updateDoc(productRef, {
                inventory: increment(-1)
            });
        }

        // 2. Process Payment via Stripe Checkout (redirects user to Stripe hosted page).
        // The webhook handler completes the purchase recording on checkout.session.completed.
        try {
            const checkoutUrl = await createOneTimePayment({
                userId: buyerId,
                items: [{
                    name: productData.title,
                    amount: Math.round(amount * 100), // convert to cents
                    quantity: 1,
                    metadata: { productId, sellerId, source, sourceId: sourceId || '' },
                }],
                metadata: { productId, sellerId, source },
            });

            // Redirect to Stripe Checkout — purchase recording happens via webhook
            if (typeof window !== 'undefined') {
                window.location.href = checkoutUrl;
            }

            // Return a pending purchase record ID so the caller can track intent
            const purchaseData: Omit<Purchase, 'id'> = {
                buyerId,
                sellerId,
                productId,
                amount,
                currency: 'USD',
                status: 'pending',
                transactionId: 'stripe_checkout_pending',
                createdAt: new Date().toISOString()
            };

            const purchaseRef = await addDoc(collection(db, this.PURCHASES_COLLECTION), purchaseData);

            // 4. Record for Revenue Tracking
            await revenueService.recordSale({
                userId: sellerId,
                productId,
                productName: productData.title,
                amount,
                currency: 'USD',
                source: source === 'social' ? 'social_drop' : source,
                sourceId,
                customerId: buyerId,
                status: 'completed'
            });

            return purchaseRef.id;

        } catch (error) {
            logger.error('[MarketplaceService] Purchase failed:', error);

            // ROLLBACK: Restore inventory if payment failed
            if (hasInventoryTracking) {
                try {
                    await updateDoc(productRef, {
                        inventory: increment(1)
                    });
                    console.info(`[MarketplaceService] Rolled back inventory for ${productId}`);
                } catch (rollbackError) {
                    logger.error(`[MarketplaceService] CRITICAL: Failed to rollback inventory for ${productId}`, rollbackError);
                    // In a real system, we'd log this to an admin alert queue
                }
            }

            throw error; // Propagate error to UI
        }
    }
}
