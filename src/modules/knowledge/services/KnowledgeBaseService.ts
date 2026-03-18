import { GeminiRetrieval, GeminiFile } from '@/services/rag/GeminiRetrievalService';
import { processForKnowledgeBase } from '@/services/rag/ragService';
import { logger } from '@/utils/logger';

export interface KnowledgeDoc {
    id: string; // The file URI or embedding ID
    title: string;
    type: string;
    size: string;
    date: string;
    status: 'indexed' | 'processing' | 'error';
    rawName: string; // The full files/URI
    mimeType: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    content: string;
    timestamp: number;
    isError?: boolean;
}

class KnowledgeBaseService {
    async getDocuments(projectId?: string): Promise<KnowledgeDoc[]> {
        try {
            const { files } = await GeminiRetrieval.listFiles();
            const docs = (files || []).map(this.mapGeminiFileToDoc);

            // Filter by project ID if provided (relies on metadata or naming convention)
            // For now, we assume strict isolation is enforced by the RAG service returning only relevant files
            // or we filter client-side if we store projectId in display name like "pid:name"
            if (projectId) {
                // Temporary: Filter logic if we adopted a naming convention
                // docs = docs.filter(prev => prev.rawName.includes(projectId)); 
            }
            return docs;
        } catch (error) {
            logger.error("KnowledgeBaseService: Failed to load docs", error);
            throw error;
        }
    }

    async uploadFiles(files: FileList, projectId?: string, onProgress?: (fileName: string) => void): Promise<number> {
        let successCount = 0;
        const uploadPromises: Promise<void>[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;
            uploadPromises.push((async () => {
                try {
                    if (onProgress) onProgress(file.name);
                    const result = await processForKnowledgeBase(file, file.name, {
                        size: `${(file.size / 1024).toFixed(1)} KB`,
                        type: file.type,
                        originalDate: new Date(file.lastModified).toISOString(),
                        projectId: projectId // Pass projectId to ingestion
                    });

                    if (result.embeddingId) {
                        successCount++;
                    } else {
                        throw new Error("Ingestion failed");
                    }
                } catch (err) {
                    logger.error(`Upload Fail for ${file.name}:`, err);
                }
            })());
        }

        await Promise.all(uploadPromises);
        return successCount;
    }

    async deleteDocument(rawName: string): Promise<void> {
        await GeminiRetrieval.deleteFile(rawName);
    }

    async chat(query: string, fileUri: string | null = null, projectId?: string): Promise<string> {
        // Pass projectId to lower layer for store selection
        const response = await GeminiRetrieval.query(fileUri, query, undefined, undefined, projectId);

        // Extract text from Gemini response structure
        // Assuming response.candidates[0].content.parts[0].text
        if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                return candidate.content.parts[0].text;
            }
        }

        return "I couldn't generate a response. Please try again.";
    }

    async *chatStream(query: string, fileUri: string | null = null, projectId?: string): AsyncGenerator<string> {
        for await (const chunk of GeminiRetrieval.streamQuery(fileUri, query, undefined, undefined, projectId)) {
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
            date: new Date(f.createTime).toLocaleDateString(),
            status: f.state === 'ACTIVE' ? 'indexed' : f.state === 'PROCESSING' ? 'processing' : 'error',
            rawName: f.name,
            mimeType: f.mimeType
        };
    }
}

export const knowledgeBaseService = new KnowledgeBaseService();
