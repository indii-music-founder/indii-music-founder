import { FirestoreService } from '@/services/FirestoreService';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export interface WikiDocument {
    id: string;          // e.g. 'Project_X' or 'Brand_Guidelines'
    userId: string;
    title: string;
    content: string;     // The compiled .md string
    category: string;    // e.g. 'project', 'brand', 'person'
    tags: string[];
    backlinks: string[]; // List of other WikiDocument IDs referenced
    createdAt: Timestamp;
    updatedAt: Timestamp;
    version: number;
}

export class WikiStorageAdapter {
    private getService(userId: string): FirestoreService<WikiDocument> {
        return new FirestoreService<WikiDocument>(`users/${userId}/knowledge_wiki`);
    }

    /**
     * Read a Wiki document by its exact slug/ID
     */
    async readWikiDoc(userId: string, docId: string): Promise<WikiDocument | null> {
        try {
            const service = this.getService(userId);
            const doc = await service.get(docId);
            return doc as WikiDocument | null;
        } catch (e) {
            logger.warn(`[WikiStorageAdapter] Failed to read doc ${docId}:`, e);
            throw e;
        }
    }

    /**
     * List all Wiki documents for context building and compilation
     */
    async listWikiDocs(userId: string): Promise<WikiDocument[]> {
        try {
            const service = this.getService(userId);
            return await service.list();
        } catch (e) {
            logger.warn(`[WikiStorageAdapter] Failed to list wiki docs for user ${userId}:`, e);
            throw e;
        }
    }

    /** Store a compiled Wiki document in Firestore. */
    async writeWikiDoc(userId: string, docId: string, updates: Partial<WikiDocument>): Promise<void> {
        const service = this.getService(userId);
        const existing = await this.readWikiDoc(userId, docId);

        const now = Timestamp.now();
        if (existing) {
            await service.update(docId, {
                ...updates,
                updatedAt: now,
                version: existing.version + 1
            } as Partial<WikiDocument>);
            logger.info(`[WikiStorageAdapter] Updated Wiki Doc: ${docId} (v${existing.version + 1})`);
        } else {
            const newDoc: WikiDocument = {
                id: docId,
                userId,
                title: updates.title || docId,
                content: updates.content || '',
                category: updates.category || 'general',
                tags: updates.tags || [],
                backlinks: updates.backlinks || [],
                createdAt: now,
                updatedAt: now,
                version: 1
            };
            await service.set(docId, newDoc);
            logger.info(`[WikiStorageAdapter] Created new Wiki Doc: ${docId}`);
        }
    }
}
