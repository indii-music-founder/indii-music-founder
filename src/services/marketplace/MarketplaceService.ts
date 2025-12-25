import { db } from '../firebase';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    query,
    where,
    serverTimestamp,
    getDoc,
    limit,
    orderBy
} from 'firebase/firestore';
import { Product, Purchase } from './types';

export class MarketplaceService {
    private static PRODUCTS_COLLECTION = 'products';
    private static PURCHASES_COLLECTION = 'purchases';

    /**
     * List products by seller
     */
    static async getSellerProducts(sellerId: string): Promise<Product[]> {
        const q = query(
            collection(db, this.PRODUCTS_COLLECTION),
            where('sellerId', '==', sellerId),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
    }

    /**
     * Create a new product
     */
    static async createProduct(product: Omit<Product, 'id' | 'createdAt' | 'isActive'>): Promise<string> {
        const newProduct = {
            ...product,
            createdAt: serverTimestamp(),
            isActive: true
        };
        const ref = await addDoc(collection(db, this.PRODUCTS_COLLECTION), newProduct);
        return ref.id;
    }

    /**
     * Purchase a product (Mock Implementation)
     * In production, this would integrate with Stripe Service.
     */
    static async purchaseProduct(buyerId: string, productId: string): Promise<Purchase | null> {
        const productRef = doc(db, this.PRODUCTS_COLLECTION, productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
            throw new Error('Product not found');
        }

        const product = productSnap.data() as Product;

        if (product.inventory !== undefined && product.inventory <= 0) {
            throw new Error('Out of stock');
        }

        // Mock Transaction
        const purchase: Omit<Purchase, 'id'> = {
            buyerId,
            sellerId: product.sellerId,
            productId,
            amount: product.price,
            currency: product.currency,
            status: 'completed',
            createdAt: new Date().toISOString(), // Client generated for now, serverTimestamp better in real app
            transactionId: `mock_tx_${Date.now()}`
        };

        const purchaseRef = await addDoc(collection(db, this.PURCHASES_COLLECTION), {
            ...purchase,
            createdAt: serverTimestamp()
        });

        // Decrement inventory if applicable
        if (product.inventory !== undefined) {
            await updateDoc(productRef, {
                inventory: product.inventory - 1
            });
        }

        return { id: purchaseRef.id, ...purchase };
    }

    /**
     * Get purchase history for a buyer
     */
    static async getPurchaseHistory(buyerId: string): Promise<Purchase[]> {
        const q = query(
            collection(db, this.PURCHASES_COLLECTION),
            where('buyerId', '==', buyerId),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
    }
}
