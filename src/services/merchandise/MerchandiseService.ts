import { db } from '@/services/firebase';
import {
    collection,
    doc,
    addDoc,
    serverTimestamp,
    onSnapshot,
    query,
    where,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { MerchProduct } from '@/modules/merchandise/types';

export class MerchandiseService {
    private static COLLECTION = 'merchandise';

    /**
     * Subscribe to products.
     */
    static subscribeToProducts(userId: string, callback: (products: MerchProduct[]) => void): () => void {
        const q = query(
            collection(db, this.COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { MerchProduct } from '@/modules/merchandise/types';

const COLLECTION_NAME = 'merchandise';

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
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as MerchProduct));
            callback(products);
        });
    }

    /**
     * Seed database with initial merch products.
     * Uses relative paths for images instead of hardcoded local paths.
     */
    static async seedDatabase(userId: string): Promise<void> {
        // Check if already seeded to avoid duplicates
        // (Implementation detail: relying on component to call this only when needed,
        // or we could check here. For efficiency, we assume the caller checks or we do a quick check).

        // Use batch for atomicity
        const batch = writeBatch(db);

        const initialProducts: Omit<MerchProduct, 'id'>[] = [
            {
                userId,
                name: "Banana Standard Tee",
                price: 24.99,
                image: "/assets/merch/banana_standard_tee.png", // Fixed path
                category: "Apparel",
                status: "active",
                inventory: 100,
                createdAt: serverTimestamp() as any
            },
            {
                userId,
                name: "Banana Hoodie",
                price: 49.99,
                image: "/assets/merch/banana_hoodie.png", // Fixed path
                category: "Apparel",
                status: "active",
                inventory: 50,
                createdAt: serverTimestamp() as any
            },
            {
                userId,
                name: "Banana Cap",
                price: 19.99,
                image: "/assets/merch/banana_cap.png", // Fixed path
                category: "Accessories",
                status: "active",
                inventory: 75,
                createdAt: serverTimestamp() as any
            }
        ];

        for (const product of initialProducts) {
            const docRef = doc(collection(db, this.COLLECTION));
            batch.set(docRef, product);
        }

        await batch.commit();
    }
}
            })) as MerchProduct[];
            callback(products);
        });
    },

    /**
     * Seed initial data if empty
     */
    seedDatabase: async (userId: string) => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) return;

        const MOCK_STANDARD: Omit<MerchProduct, 'id'>[] = [
            {
                title: "Banana Standard Tee",
                price: "$24.99",
                image: "file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/brain/34958d54-a9d0-4ced-a8bb-687671d31774/banana_standard_tshirt_mockup_1767126973658.png",
                tags: ["Streetwear", "Cotton", "Unisex"],
                category: 'standard',
                userId,
                createdAt: serverTimestamp()
            },
            {
                title: "Banana Pop Hoodie",
                price: "$49.99",
                image: "file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/brain/34958d54-a9d0-4ced-a8bb-687671d31774/banana_standard_tshirt_mockup_1767126973658.png",
                tags: ["Fleece", "Oversized", "Vibrant"],
                category: 'standard',
                userId,
                createdAt: serverTimestamp()
            }
        ];

        const MOCK_PRO: Omit<MerchProduct, 'id'>[] = [
            {
                title: "PRO // TEE.001",
                price: "$45.00",
                image: "file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/brain/34958d54-a9d0-4ced-a8bb-687671d31774/banana_pro_tshirt_mockup_1767126990008.png",
                features: ["Moisture Wicking", "Embedded NFC"],
                category: 'pro',
                userId,
                createdAt: serverTimestamp()
            },
            {
                title: "PRO // HOODIE.BLK",
                price: "$85.00",
                image: "file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/brain/34958d54-a9d0-4ced-a8bb-687671d31774/banana_pro_tshirt_mockup_1767126990008.png",
                features: ["Heavyweight", "Water Resistant"],
                category: 'pro',
                userId,
                createdAt: serverTimestamp()
            }
        ];

        const allProducts = [...MOCK_STANDARD, ...MOCK_PRO];

        await Promise.all(allProducts.map(p => addDoc(collection(db, COLLECTION_NAME), p)));
    },

    /**
     * Add a new product
     */
    addProduct: async (product: Omit<MerchProduct, 'id'>) => {
        await addDoc(collection(db, COLLECTION_NAME), {
            ...product,
            createdAt: serverTimestamp()
        });
    },

    /**
     * Delete a product
     */
    deleteProduct: async (productId: string) => {
        await deleteDoc(doc(db, COLLECTION_NAME, productId));
    }
};
