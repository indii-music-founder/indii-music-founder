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
