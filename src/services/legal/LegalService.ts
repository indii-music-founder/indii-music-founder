import { db } from '@/services/firebase';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    updateDoc,
    Timestamp
} from 'firebase/firestore';
import { useStore } from '@/core/store';
import { LegalContract, ContractStatus } from '@/modules/legal/types';

export class LegalService {

    /**
     * Save a new contract draft
     */
    static async saveContract(data: Omit<LegalContract, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) throw new Error("User not authenticated");

        const contractData = {
            ...data,
            userId: userProfile.id,
            status: data.status || ContractStatus.DRAFT,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'users', userProfile.id, 'contracts'), contractData);
        return docRef.id;
    }

    /**
     * Update an existing contract
     */
    static async updateContract(id: string, updates: Partial<LegalContract>): Promise<void> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) throw new Error("User not authenticated");

        const docRef = doc(db, 'users', userProfile.id, 'contracts', id);

        // Sanitize updates
        const { id: _id, userId: _userId, createdAt: _createdAt, ...cleanUpdates } = updates;

        await updateDoc(docRef, {
            ...cleanUpdates,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Get all contracts for the current user
     */
    static async getContracts(): Promise<LegalContract[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        const q = query(
            collection(db, 'users', userProfile.id, 'contracts'),
            orderBy('updatedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as unknown as LegalContract));
    }

    /**
     * Get a single contract by ID
     */
    static async getContractById(id: string): Promise<LegalContract | null> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return null;

        const docRef = doc(db, 'users', userProfile.id, 'contracts', id);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            return {
                id: snapshot.id,
                ...snapshot.data()
            } as unknown as LegalContract;
        }
        return null;
    }
}
