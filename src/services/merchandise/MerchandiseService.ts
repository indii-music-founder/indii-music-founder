import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, functions } from '@/services/firebase';
import { MerchProduct } from '@/modules/merchandise/types';
import { AppException, AppErrorCode } from '@/shared/types/errors';
import { delay } from '@/utils/async';
import { useStore } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { httpsCallable } from 'firebase/functions';
import { VideoGenerationService } from '@/services/video/VideoGenerationService';
import { v4 as uuidv4 } from 'uuid';

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
     * Uses persistent AI generation of photorealistic mockups via ImageGenerationService.
     */
    generateMockup: async (asset: string, type: string, scene: string): Promise<string> => {
        const userId = useStore.getState().userProfile?.id;

        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'User must be logged in to generate mockups.');
        }

        const prompt = `Photorealistic product mockup of a ${type} with the following design: ${scene}. Professional studio lighting, high resolution, product photography.`;

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
            // Call the real Image Generation Service
            // Note: asset is a string ID here, usually you'd resolve it to a URL or base64.
            // For now, we assume the 'scene' description includes enough info or 'asset' is a URL.
            // If asset is a URL, we should ideally fetch and pass it as sourceImage, but ImageGenerationService.generateImages supports sourceImages as {mimeType, data}.
            // Given the signature, we'll rely on the prompt for now.

            const results = await ImageGeneration.generateImages({
                prompt: prompt,
                count: 1,
                aspectRatio: '1:1'
            });

            if (results.length > 0) {
                const resultUrl = results[0].url;
                // Update the record with the result
                await updateDoc(docRef, {
                    resultUrl,
                    status: 'completed'
                });
                return resultUrl;
            }

            throw new Error('No images generated');
        } catch (error: any) {
             await updateDoc(docRef, {
                status: 'failed',
                error: error.message
            });
            throw error;
        }
    },

    /**
     * Generates a video request and saves to Firestore.
     * Uses persistent AI generation of product animations via VideoGenerationService.
     * Returns the Job ID for subscription.
     */
    generateVideo: async (mockupUrl: string, motion: string): Promise<string> => {
        const userId = useStore.getState().userProfile?.id;
        const orgId = useStore.getState().currentOrganizationId;

        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'User must be logged in to generate videos.');
        }

        const prompt = `Cinematic product video of the provided mockup. ${motion}. High quality, 4k, professional lighting.`;

        // Use the Cloud Function directly via VideoGenerationService logic pattern
        // We use triggerVideoJob cloud function which queues it.
        const jobId = uuidv4();

        const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');

        try {
            await triggerVideoJob({
                jobId,
                prompt,
                // We pass the mockupUrl as 'startImage' or just part of context if Veo supports input image.
                // VideoGenerationService uses 'firstFrame' for start image.
                firstFrame: mockupUrl,
                duration: 5, // Default short clip
                orgId: orgId || "personal"
            });

             // We also want to track this in our own collection if needed,
             // but 'triggerVideoJob' already creates a document in 'videoJobs'.
             // We can return the jobId and let the UI subscribe to 'videoJobs'.

             return jobId;

        } catch (error: any) {
            console.error("Video Generation Error:", error);
            throw error;
        }
    },

    /**
     * Subscribe to a video job status.
     * Re-exported for convenience from Merchandise Service
     */
    subscribeToVideoJob: (jobId: string, callback: (job: any) => void) => {
         const jobRef = doc(db, 'videoJobs', jobId);
         return onSnapshot(jobRef, (snapshot) => {
             if (snapshot.exists()) {
                 callback({ id: snapshot.id, ...snapshot.data() });
             } else {
                 callback(null);
             }
         });
    }
};
