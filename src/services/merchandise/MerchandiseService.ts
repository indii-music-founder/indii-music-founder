import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { MerchProduct } from '@/modules/merchandise/types';
import { AppException, AppErrorCode } from '@/shared/types/errors';
import { delay } from '@/utils/async';
import { useStore } from '@/core/store';

const COLLECTION_NAME = 'merchandise';
const CATALOG_COLLECTION = 'merchandise_catalog';

export interface CatalogProduct {
    id: string;
    title: string;
    basePrice: number;
    image: string;
    tags?: string[];
    features?: string[];
    category: 'standard' | 'pro';
    description?: string;
}

export interface ManufactureRequest {
    productId: string;
    variantId: string;
    quantity: number;
    userId?: string;
    status?: 'pending' | 'processing' | 'completed';
    orderId?: string;
    createdAt?: any;
}

export interface MockupGeneration {
    asset: string;
    type: string;
    scene: string;
    resultUrl?: string;
    userId?: string;
    createdAt?: any;
}

export const MerchandiseService = {
    /**
     * Subscribe to products for a user
     */
    subscribeToProducts: (userId: string, callback: (products: MerchProduct[]) => void) => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot) => {
            const products = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as MerchProduct));
            callback(products);
        });
    },

    /**
     * Get available product templates from the catalog
     * These are admin-managed templates users can customize
     */
    getCatalog: async (): Promise<CatalogProduct[]> => {
        try {
            const snapshot = await getDocs(collection(db, CATALOG_COLLECTION));
            return snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as CatalogProduct));
        } catch (error) {
            console.warn('[MerchandiseService] Failed to load catalog:', error);
            return [];
        }
    },

    /**
     * Create a product from a catalog template
     */
    createFromCatalog: async (catalogId: string, userId: string, customizations?: {
        title?: string;
        price?: string;
        image?: string;
    }) => {
        const catalog = await MerchandiseService.getCatalog();
        const template = catalog.find(p => p.id === catalogId);

        if (!template) {
            throw new Error(`Catalog product ${catalogId} not found`);
        }

        const product: Omit<MerchProduct, 'id'> = {
            title: customizations?.title || template.title,
            price: customizations?.price || `$${template.basePrice.toFixed(2)}`,
            image: customizations?.image || template.image,
            tags: template.tags,
            features: template.features,
            category: template.category,
            userId,
            createdAt: serverTimestamp()
        };

        return await MerchandiseService.addProduct(product);
    },

    /**
     * Add a new product
     */
    addProduct: async (product: Omit<MerchProduct, 'id'>) => {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...product,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Delete a product
     */
    deleteProduct: async (productId: string) => {
        await deleteDoc(doc(db, COLLECTION_NAME, productId));
    },

    /**
     * Submits a design to the production line (Firestore).
     */
    submitToProduction: async (request: ManufactureRequest): Promise<{ success: boolean; orderId: string }> => {
        try {
            let userId = request.userId;
            if (!userId) {
                userId = useStore.getState().userProfile?.id;
            }

            if (!userId) {
                throw new AppException(AppErrorCode.AUTH_ERROR, 'User must be logged in to submit to production.');
            }

            const orderId = `BANA-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            const docRef = await addDoc(collection(db, 'manufacture_requests'), {
                ...request,
                userId,
                status: 'pending',
                orderId,
                createdAt: serverTimestamp()
            });

            // Simulate processing delay then update status
            delay(2000).then(async () => {
                try {
                    await updateDoc(docRef, { status: 'completed' });
                } catch (e) {
                    // Status update failed - not critical
                }
            });

            return {
                success: true,
                orderId
            };
        } catch (error) {
            throw error;
        }
    },

    /**
     * Generates a mockup request and saves to Firestore.
     * persistent AI generation of photorealistic mockups.
     */
    generateMockup: async (asset: string, type: string, scene: string): Promise<string> => {
        const userId = useStore.getState().userProfile?.id;

        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'User must be logged in to generate mockups.');
        }

        // Record the generation request
        const docRef = await addDoc(collection(db, 'mockup_generations'), {
            userId,
            asset,
            type,
            scene,
            status: 'processing',
            createdAt: serverTimestamp()
        });

        try {
            // Beta delay
            await delay(3000);

            // Mock result for now, but persistent record exists
            const resultUrl = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80";

            // Update the record with the result
            await updateDoc(docRef, {
                resultUrl,
                status: 'completed'
            });

            return resultUrl;
        } catch (error) {
            // Fallback for errors
            return "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80";
        }
    },

    /**
     * Generates a video request and saves to Firestore.
     * Simulates AI generation of product animations (Persistent).
     */
    generateVideo: async (mockupUrl: string, motion: string): Promise<string> => {
        const userId = useStore.getState().userProfile?.id;

        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'User must be logged in to generate videos.');
        }

        const docRef = await addDoc(collection(db, 'video_generations'), {
            userId,
            mockupUrl,
            motion,
            status: 'processing',
            createdAt: serverTimestamp()
        });

        try {
            await delay(3500);

            const resultUrl = "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJieHlzZ254Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxxXmD3v6Te/giphy.gif";

            await updateDoc(docRef, {
                resultUrl,
                status: 'completed'
            });

            return resultUrl;
        } catch (error) {
            // Fallback for errors
            return "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJieHlzZ254Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4Z3V4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxxXmD3v6Te/giphy.gif";
        }
    }
};
