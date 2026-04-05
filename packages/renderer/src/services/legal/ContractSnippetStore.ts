import { Timestamp, getFirestore, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { app } from '@/services/firebase';
import { logger } from '@/utils/logger';

export interface ContractSnippet {
    id?: string;
    title: string;
    content: string;
    category: 'talent' | 'licensing' | 'distribution' | 'marketing' | 'performance';
    status: 'draft' | 'active' | 'archived';
    tags: string[];
    updatedAt: Date | Timestamp;
}

export class ContractSnippetStore {
    private db = getFirestore(app);
    private collectionRef = collection(this.db, 'contract_snippets');

    /**
     * Retrieve all active snippets for a specific category.
     */
    async getByCategory(category?: ContractSnippet['category']): Promise<ContractSnippet[]> {
        try {
            const q = category
                ? query(this.collectionRef, where('category', '==', category), where('status', '==', 'active'))
                : query(this.collectionRef, where('status', '==', 'active'), orderBy('category', 'asc'));

            const snapshot = await getDocs(q);
            const snippets: ContractSnippet[] = [];

            snapshot.forEach(doc => {
                snippets.push({ id: doc.id, ...doc.data() } as ContractSnippet);
            });

            logger.info(`[SnippetStore] Fetched ${snippets.length} snippets for ${category || 'ALL'}`);
            return snippets;
        } catch (error: unknown) {
            logger.error('[SnippetStore] Failed to fetch snippets:', error);
            return [];
        }
    }

    /**
     * Add a new reusable snippet to the library.
     */
    async addSnippet(snippet: Omit<ContractSnippet, 'id' | 'updatedAt'>): Promise<string> {
        try {
            const docRef = await addDoc(this.collectionRef, {
                ...snippet,
                updatedAt: new Date(),
            });
            logger.info(`[SnippetStore] Added new snippet: ${snippet.title}`);
            return docRef.id;
        } catch (error: unknown) {
            logger.error('[SnippetStore] Failed to add snippet:', error);
            throw error;
        }
    }

    /**
     * Seed the database with common talent agreement snippets.
     */
    async seedCommonSnippets(): Promise<void> {
        const commonSnippets: Omit<ContractSnippet, 'id' | 'updatedAt'>[] = [
            {
                title: 'Work for Hire - Creative Services',
                content: 'All results and proceeds of talent’s services hereunder shall be deemed a “work-made-for-hire” for Producer. If not so deemed, Talent hereby assigns and transfers all right, title, and interest in perpetuity.',
                category: 'talent',
                status: 'active',
                tags: ['ownership', 'work-for-hire', 'talent-agreement']
            },
            {
                title: 'Confidentiality and non-disclosure',
                content: 'Talent acknowledges that they will have access to confidential information regarding Artist releases. Talent agrees not to disclose such information to any third party without prior written consent.',
                category: 'marketing',
                status: 'active',
                tags: ['confidentiality', 'NDA']
            },
            {
                title: 'Licensing - Territory (World-Wide)',
                content: 'Producer hereby grants to Licensee a non-exclusive, world-wide license to exploit the Master in any and all media now known or hereafter devised, in perpetutity.',
                category: 'licensing',
                status: 'active',
                tags: ['licensing', 'territory']
            }
        ];

        for (const s of commonSnippets) {
            await this.addSnippet(s);
        }
        logger.info('[SnippetStore] Successfully seeded common snippets.');
    }
}

export const snippetStore = new ContractSnippetStore();
