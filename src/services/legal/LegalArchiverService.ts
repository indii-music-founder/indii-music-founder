/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { app } from '@/services/firebase';
import { logger } from '@/utils/logger';

export interface LegalAgreement {
    id?: string;
    type: 'terms' | 'privacy' | 'refund' | 'eula';
    versionId: string; // semver
    contentHash: string;
    publishedAt: any;
    status: 'draft' | 'published' | 'archived';
    publicUrl: string;
}

export class LegalArchiverService {
    private db = getFirestore(app);
    private collectionRef = collection(this.db, 'legal_agreements');

    /**
     * Snapshots a legal document version to the history ledger.
     */
    async archiveVersion(agreement: Omit<LegalAgreement, 'id' | 'publishedAt'>): Promise<string> {
        try {
            const docRef = await addDoc(this.collectionRef, {
                ...agreement,
                publishedAt: serverTimestamp(),
            });
            logger.info(`[LegalArchiver] Archived ${agreement.type} v${agreement.versionId}`);
            return docRef.id;
        } catch (error) {
            logger.error('[LegalArchiver] Failed to archive version:', error);
            throw error;
        }
    }

    /**
     * Retrieve the latest version of an agreement type.
     */
    async getLatest(type: LegalAgreement['type']): Promise<LegalAgreement | null> {
        try {
            const q = query(
                this.collectionRef,
                where('type', '==', type),
                where('status', '==', 'published'),
                orderBy('publishedAt', 'desc'),
                limit(1)
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            const doc = snapshot.docs[0]!;
            return { id: doc.id, ...doc.data() } as LegalAgreement;
        } catch (error) {
            logger.error(`[LegalArchiver] Failed to get latest for ${type}:`, error);
            return null;
        }
    }

    /**
     * Compute hash of content for integrity check (simple implementation)
     */
    async generateContentHash(content: string): Promise<string> {
        const msgUint8 = new TextEncoder().encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

export const legalArchiver = new LegalArchiverService();
