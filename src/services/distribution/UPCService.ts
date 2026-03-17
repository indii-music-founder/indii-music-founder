import { getFirestore, collection, addDoc, getDocs, query, where, limit, runTransaction } from 'firebase/firestore';
import { app, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';

export interface UPCRecord {
    id?: string;
    upc: string;
    status: 'available' | 'assigned' | 'reserved';
    assignedTo?: string; // Release ID
    assignedAt?: Date;
}

export interface UPCRegistryEntry {
    id?: string;
    upc: string;
    releaseId: string;
    userId: string;
    releaseTitle?: string;
    assignedAt: Date;
}

// Item 409: UPC barcode generation from pre-purchased block stored in Firestore
export class UPCService {
    private db = getFirestore(app);
    private poolRef = collection(this.db, 'upc_pool');
    private registryRef = collection(this.db, 'upc_registry');

    /**
     * Assigns the next available UPC from the pre-purchased pool to a release.
     * Uses a Firestore transaction to prevent double-assignment.
     */
    async assignNextUPC(releaseId: string): Promise<string> {
        try {
            return await runTransaction(this.db, async (transaction) => {
                const q = query(this.poolRef, where('status', '==', 'available'), limit(1));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    throw new Error('UPC pool is exhausted. Please add more UPC codes to the pool.');
                }

                const upcDoc = snapshot.docs[0];
                const upcData = upcDoc.data() as UPCRecord;

                transaction.update(upcDoc.ref, {
                    status: 'assigned',
                    assignedTo: releaseId,
                    assignedAt: new Date(),
                });

                logger.info(`[UPC] Assigned ${upcData.upc} to release ${releaseId}`);
                return upcData.upc;
            });
        } catch (error) {
            logger.error('[UPC] Assignment failed:', error);
            throw error;
        }
    }

    /**
     * Seed the pool with pre-purchased UPC codes.
     * UPCs are 12-digit numeric strings (EAN-13 compatible when prefixed with 0).
     */
    async seedPool(upcs: string[]): Promise<void> {
        for (const upc of upcs) {
            if (!this.isValidUPC(upc)) {
                logger.warn(`[UPC] Skipping invalid UPC: ${upc}`);
                continue;
            }
            await addDoc(this.poolRef, {
                upc,
                status: 'available',
            });
        }
        logger.info(`[UPC] Seeded ${upcs.length} UPCs into the pool.`);
    }

    /** Record a UPC assignment in the registry for audit trail. Returns the new document ID. */
    async recordAssignment(data: Omit<UPCRegistryEntry, 'id'>): Promise<string> {
        const docRef = await addDoc(this.registryRef, data);
        logger.info(`[UPC] Recorded assignment for ${data.upc}`);
        return docRef.id;
    }

    /** Look up a registry record by UPC string. Returns null if not found. */
    async getByUPC(upc: string): Promise<UPCRegistryEntry | null> {
        const q = query(this.registryRef, where('upc', '==', upc), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as UPCRegistryEntry;
    }

    /** Look up the UPC assigned to a specific release. Returns null if not assigned. */
    async getByRelease(releaseId: string): Promise<UPCRegistryEntry | null> {
        const q = query(this.registryRef, where('releaseId', '==', releaseId), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as UPCRegistryEntry;
    }

    /** Get all UPC assignments belonging to the current user. */
    async getUserCatalog(): Promise<UPCRegistryEntry[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        const q = query(this.registryRef, where('userId', '==', userId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as UPCRegistryEntry));
    }

    /** Returns the count of available UPCs remaining in the pool. */
    async getPoolSize(): Promise<number> {
        const q = query(this.poolRef, where('status', '==', 'available'));
        const snap = await getDocs(q);
        return snap.size;
    }

    /**
     * Validates a UPC-A (12-digit) or EAN-13 (13-digit) barcode using check digit.
     */
    isValidUPC(upc: string): boolean {
        if (!/^\d{12}$/.test(upc) && !/^\d{13}$/.test(upc)) return false;

        const digits = upc.split('').map(Number);
        const checkDigit = digits.pop()!;
        const isEAN13 = digits.length === 12;

        let sum = 0;
        for (let i = 0; i < digits.length; i++) {
            const weight = isEAN13 ? (i % 2 === 0 ? 1 : 3) : (i % 2 === 0 ? 3 : 1);
            sum += digits[i] * weight;
        }
        const computed = (10 - (sum % 10)) % 10;
        return computed === checkDigit;
    }
}

export const upcService = new UPCService();
