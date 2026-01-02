import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { MerchProduct } from '@/modules/merchandise/types';

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

export const MerchandiseService = {
    /**
     * Subscribe to products for a user
     */
    subscribeToProducts: (userId: string, callback: (products: MerchProduct[]) => void, errorCallback?: (error: any) => void) => {
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
        }, errorCallback);
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
            console.error('[MerchandiseService] Failed to load catalog:', error);
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
    }
};
