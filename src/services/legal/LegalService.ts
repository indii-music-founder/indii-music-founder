import { AppException, AppErrorCode } from '@/shared/types/errors';
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
    updateDoc
} from 'firebase/firestore';
import { useStore } from '@/core/store';
import { LegalContract, ContractStatus } from '@/modules/legal/types';

export class LegalService {

    private static escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Save a new contract draft
     */
    static async saveContract(data: Omit<LegalContract, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) {
            throw new AppException(
                AppErrorCode.AUTH_ERROR,
                'User not authenticated'
            );
        }

        const contractData = {
            ...data,
            userId: userProfile.id,
            status: data.status || ContractStatus.DRAFT,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'contracts'), contractData);
        return docRef.id;
    }

    /**
     * Update an existing contract
     */
    static async updateContract(id: string, updates: Partial<LegalContract>): Promise<void> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) {
            throw new AppException(
                AppErrorCode.AUTH_ERROR,
                'User not authenticated'
            );
        }

        const docRef = doc(db, 'contracts', id);

        // Security Check: Verify ownership before update
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.userId !== userProfile.id) {
                throw new AppException(
                    AppErrorCode.UNAUTHORIZED,
                    'You do not have permission to update this contract'
                );
            }
        }

        await updateDoc(docRef, {
            ...updates,
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
            collection(db, 'contracts'),
            where('userId', '==', userProfile.id),
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

        const docRef = doc(db, 'contracts', id);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            const data = snapshot.data();
            // Safety check: ensure user owns this contract
            if (data.userId !== userProfile.id) return null;

            return {
                id: snapshot.id,
                ...data
            } as unknown as LegalContract;
        }
        return null;
    }

    /**
     * Export a contract to PDF
     */
    static async exportContractToPDF(id: string): Promise<boolean> {
        const contract = await this.getContractById(id);
        if (!contract) throw new Error('Contract not found');

        // Note: For actual Markdown to HTML conversion in the tool or background,
        // we'd use marked or similar. Here we'll wrap it in standard HTML tags.
        // The electron handler handles the styling.
        const createdAt = contract.createdAt;
        const dateString = createdAt && typeof (createdAt as any).toDate === 'function'
            ? (createdAt as any).toDate().toLocaleDateString()
            : new Date(typeof createdAt === 'number' ? createdAt : Date.now()).toLocaleDateString();

        const html = `
            <h1>${this.escapeHtml(contract.title)}</h1>
            <div><strong>Date:</strong> ${this.escapeHtml(dateString)}</div>
            <div><strong>Parties:</strong> ${contract.parties.map(p => this.escapeHtml(p)).join(', ')}</div>
            <div style="margin-top: 20px;">
                ${contract.content.split('\n').map(line => `<p>${this.escapeHtml(line)}</p>`).join('')}
            </div>
        `;

        if (window.electronAPI?.savePDF) {
            const result = await window.electronAPI.savePDF(html, contract.title);
            return result.success;
        } else {
            // Fallback for web version
            console.warn('[LegalService] Electron bridge unavailable. Using browser print.');
            window.print();
            return true;
        }
    }
}
