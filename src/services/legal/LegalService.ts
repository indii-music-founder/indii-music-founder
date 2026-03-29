import { AppException, AppErrorCode } from '@/shared/types/errors';
import { db } from '@/services/firebase';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import { useStore } from '@/core/store';
import { LegalContract, ContractStatus } from '@/modules/legal/types';

export interface ContractAnalysis {
    id?: string;
    fileName: string;
    score: number;
    summary: string;
    risks: string[];
    analyzedAt: string;
}

// Lazy load to break agent dependencies from UI layer if not directly used
let LegalToolsModule: any = null;
async function getLegalTools() {
    if (!LegalToolsModule) {
        LegalToolsModule = await import('@/services/agent/tools/LegalTools');
    }
    return LegalToolsModule.LegalTools;
}

export class LegalService {

    /**
     * Save a new contract draft
     */
    static async saveContract(data: Omit<LegalContract, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'User not authenticated');
        }

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
        if (!userProfile?.id) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'User not authenticated');
        }

        const docRef = doc(db, 'users', userProfile.id, 'contracts', id);
        await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
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
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as LegalContract));
    }

    /**
     * Get a single contract by ID
     */
    static async getContractById(id: string): Promise<LegalContract | null> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return null;

        const snapshot = await getDoc(doc(db, 'users', userProfile.id, 'contracts', id));
        return snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as unknown as LegalContract)
            : null;
    }

    // -----------------------------------------------------------------------
    // Contract Analysis persistence
    // -----------------------------------------------------------------------

    /**
     * Persist an AI contract analysis result to Firestore.
     * Stored under users/{uid}/contract_analyses.
     */
    static async saveAnalysis(analysis: Omit<ContractAnalysis, 'id'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) {
            // Silently skip if unauthenticated — analysis results are still shown in UI
            return '';
        }

        const docRef = await addDoc(
            collection(db, 'users', userProfile.id, 'contract_analyses'),
            { ...analysis, savedAt: serverTimestamp() }
        );
        return docRef.id;
    }

    /**
     * Fetch the 20 most recent contract analyses for the current user.
     */
    static async getAnalyses(): Promise<ContractAnalysis[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        const q = query(
            collection(db, 'users', userProfile.id, 'contract_analyses'),
            orderBy('savedAt', 'desc'),
            limit(20)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ContractAnalysis));
    }

    // -----------------------------------------------------------------------
    // Agent Tool Wrappers (Decoupling UI from direct Agent invocations)
    // -----------------------------------------------------------------------

    /**
     * Generate an NDA via AI Agent 
     */
    static async generateNDA(parties: string[], purpose: string) {
        const tools = await getLegalTools();
        if (!tools.generate_nda) throw new Error('Tool generate_nda is missing');
        return tools.generate_nda({ parties, purpose });
    }

    /**
     * Draft an arbitrary contract via AI Agent
     */
    static async draftContract(type: string, parties: string[], terms: string) {
        const tools = await getLegalTools();
        if (!tools.draft_contract) throw new Error('Tool draft_contract is missing');
        return tools.draft_contract({ type, parties, terms });
    }
}
