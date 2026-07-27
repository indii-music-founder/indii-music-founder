import { GeminiRetrieval, GeminiFile } from '@/services/rag/GeminiRetrievalService';
import { processForKnowledgeBase } from '@/services/rag/ragService';
import { knowledgeRetrievalService, FrontendKnowledgeDoc } from './KnowledgeRetrievalService';
import { logger } from '@/utils/logger';
import { WikiStorageAdapter } from '@/services/agent/memory/WikiStorageAdapter';
import { auth } from '@/services/firebase';

export interface KnowledgeDoc {
    id: string; // The file URI or embedding ID
    title: string;
    type: string;
    size: string;
    date: string;
    status: 'indexed' | 'processing' | 'error' | 'needs_reupload';
    rawName: string; // The full files/URI
    mimeType: string;
    content?: string; // Optional: raw content if it's a Wiki
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    content: string;
    timestamp: number;
    isError?: boolean;
}

class KnowledgeBaseService {
    private wikiStorage = new WikiStorageAdapter();

    async getDocuments(projectId?: string): Promise<KnowledgeDoc[]> {
        try {
            const docs: KnowledgeDoc[] = [];

            // 1. Fetch new RAG Documents from KnowledgeRetrievalService
            try {
                const newDocs = await knowledgeRetrievalService.getDocuments(projectId);
                docs.push(...newDocs);
            } catch (err) {
                logger.error("KnowledgeBaseService: Failed to load new RAG documents", err);
            }

            // 2. Fetch Legacy RAG Files (mark as needs_reupload)
            try {
                const { files } = await GeminiRetrieval.listFiles();
                const legacyDocs = (files || []).map(f => {
                    const doc = this.mapGeminiFileToDoc(f);
                    doc.status = 'needs_reupload'; // Force re-upload requirement
                    return doc;
                });
                docs.push(...legacyDocs);
            } catch (ragError) {
                logger.warn("KnowledgeBaseService: Failed to load legacy RAG files from proxy", ragError);
            }

            // 3. Fetch Wiki Documents
            if (auth.currentUser) {
                const wikiDocs = await this.wikiStorage.listWikiDocs(auth.currentUser.uid);
                const mappedWikiDocs = wikiDocs.map(w => ({
                    id: w.id,
                    title: w.title,
                    type: 'WIKI',
                    size: `${(w.content.length / 1024).toFixed(1)} KB`,
                    date: w.updatedAt.toDate().toLocaleDateString('en-US'),
                    status: 'indexed' as const,
                    rawName: w.id,
                    mimeType: 'text/markdown',
                    content: w.content
                }));
                docs.push(...mappedWikiDocs);
            }

            // Filter by project ID if provided
            if (projectId) {
                // docs = docs.filter(prev => prev.rawName.includes(projectId)); 
            }
            return docs;
        } catch (error: unknown) {
            logger.error("KnowledgeBaseService: Failed to load docs completely", error);
            throw error;
        }
    }

    async uploadFiles(files: FileList, projectId?: string, onProgress?: (fileName: string) => void): Promise<number> {
        return knowledgeRetrievalService.uploadFiles(files, projectId, onProgress);
    }

    async deleteDocument(rawName: string): Promise<void> {
        if (rawName.startsWith('files/')) {
            await GeminiRetrieval.deleteFile(rawName);
        } else {
            await knowledgeRetrievalService.deleteDocument(rawName);
        }
    }

    async chat(query: string, fileUri: string | null = null, projectId?: string): Promise<string> {
        return knowledgeRetrievalService.chat(query, fileUri, projectId);
    }

    async *chatStream(query: string, fileUri: string | null = null, projectId?: string): AsyncGenerator<string> {
        for await (const chunk of knowledgeRetrievalService.chatStream(query, fileUri, projectId)) {
            yield chunk;
        }
    }

    private mapGeminiFileToDoc(f: GeminiFile): KnowledgeDoc {
        return {
            id: f.name,
            title: f.displayName || f.name.split('/').pop() || 'Untitled',
            type: f.mimeType.includes('pdf') ? 'PDF' :
                f.mimeType.includes('markdown') ? 'MD' :
                    f.mimeType.includes('text') ? 'TXT' : 'FILE',
            size: f.sizeBytes ? `${(parseInt(f.sizeBytes) / 1024).toFixed(1)} KB` : 'Unknown',
            date: new Date(f.createTime).toLocaleDateString('en-US'),
            status: f.state === 'ACTIVE' ? 'indexed' : f.state === 'PROCESSING' ? 'processing' : 'error',
            rawName: f.name,
            mimeType: f.mimeType
        };
    }
}

export const knowledgeBaseService = new KnowledgeBaseService();
