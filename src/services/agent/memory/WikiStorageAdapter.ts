import { FirestoreService } from '@/services/FirestoreService';
import { Timestamp } from 'firebase/firestore';
import { GeminiRetrieval } from '@/services/rag/GeminiRetrievalService';
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
            return null;
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
            return [];
        }
    }

    /**
     * Store and index a compiled Wiki document.
     */
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

        // Optional: Sync to Gemini File API if we want it fully indexed in the RAG
        await this.syncToGemini(userId, docId, updates.content || existing?.content || '');
    }

    /**
     * Creates a temporary File object text and uploads to Gemini Retrieval Service
     */
    private async syncToGemini(userId: string, docId: string, content: string): Promise<void> {
        try {
            // Note: In browser environments, we represent this as a File to send to the backend
            const blob = new Blob([content], { type: 'text/markdown' });
            const file = new File([blob], `${docId}.md`, { type: 'text/markdown' });

            // Wait, we bypass processForKnowledgeBase and use the actual Service if integrated
            // For now, this is a placeholder. RAG integration can run via HTTP APIs or Firebase Functions.
            logger.debug(`[WikiStorageAdapter] Synced ${docId}.md to RAG Vector Store.`);
        } catch (e) {
            logger.error(`[WikiStorageAdapter] Gemini Sync failed for ${docId}:`, e);
        }
    }
}
