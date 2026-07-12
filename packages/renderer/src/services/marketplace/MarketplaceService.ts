import { db, storage, functions } from '@/services/firebase';
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Timestamp,
    updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { Product, StemFile, StemLabel } from './types';
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
                    createdAt: (data.createdAt && typeof (data.createdAt as { toDate?: () => Date }).toDate === 'function') ? (data.createdAt as { toDate: () => Date }).toDate().toISOString() : (data.createdAt ? new Date(data.createdAt as string | number).toISOString() : new Date().toISOString())
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
        } catch (error: unknown) {
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
            createdAt: (doc.data().createdAt && typeof (doc.data().createdAt as { toDate?: () => Date }).toDate === 'function') ? (doc.data().createdAt as { toDate: () => Date }).toDate().toISOString() : (doc.data().createdAt ? new Date(doc.data().createdAt as string | number).toISOString() : new Date().toISOString())
        } as Product));

        return results;
    }

    /**
     * Check whether a buyer already holds a completed purchase for a product.
     * Reflects the durable, webhook-finalized record — not client-side intent.
     */
    static async hasCompletedPurchase(buyerId: string, productId: string): Promise<boolean> {
        const q = query(
            collection(db, this.PURCHASES_COLLECTION),
            where('buyerId', '==', buyerId),
            where('productId', '==', productId),
            where('status', '==', 'completed')
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
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
        } catch (error: unknown) {
            logger.error(`Failed to delete product ${productId}:`, error);
            throw error;
        }
    }

    /**
     * Initiate a purchase for a product.
     *
     * ISSUE-977 / ISSUE-978 fix: the price is loaded server-side from the
     * authoritative product record (never trusted from the client), and
     * inventory/revenue are only ever mutated by the `createMarketplaceCheckout`
     * Cloud Function (atomic reservation) and the Stripe webhook (finalization
     * after payment is confirmed) — never by this client call. This redirects
     * to Stripe Checkout; there is nothing left to record here.
     */
    static async purchaseProduct(
        productId: string,
        source: string = 'direct',
        sourceId?: string
    ): Promise<void> {
        const createMarketplaceCheckout = httpsCallable<
            { productId: string; source?: string; sourceId?: string; successUrl: string; cancelUrl: string },
            { checkoutUrl: string; sessionId: string }
        >(functions, 'createMarketplaceCheckout');

        const result = await createMarketplaceCheckout({
            productId,
            source,
            sourceId,
            successUrl: `${window.location.origin}${window.location.pathname}?purchase=success`,
            cancelUrl: `${window.location.origin}${window.location.pathname}?purchase=cancelled`,
        });

        if (!result.data.checkoutUrl) {
            throw new Error('No checkout URL returned from server.');
        }

        window.location.href = result.data.checkoutUrl;
    }
}
