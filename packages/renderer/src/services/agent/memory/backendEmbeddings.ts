import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import { logger } from '@/utils/logger';

/**
 * ISSUE-1377: browser-side Firebase AI embeddings are disabled by design
 * (EmbeddingGenerator fail-closes), so agent memory ingestion/search ran with
 * empty vectors and semantic recall silently returned nothing. All memory
 * vectors now come from the backend `batchEmbedText` callable
 * (text-embedding-004). On failure, returns empty vectors per text so memory
 * features degrade gracefully (keyword search still applies) instead of
 * crashing the pipeline.
 */
export async function backendEmbedTexts(texts: string[]): Promise<number[][]> {
    try {
        const batchEmbedText = httpsCallable<{ texts: string[] }, { embeddings: number[][] }>(
            functions,
            'batchEmbedText'
        );
        const result = await batchEmbedText({ texts });
        const embeddings = result.data?.embeddings;
        if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
            throw new Error('Batch embedding returned an unexpected shape.');
        }
        return embeddings;
    } catch (error: unknown) {
        logger.warn('[MemoryEmbedding] Backend batch embedding failed; returning empty vectors:', error);
        return texts.map(() => []);
    }
}
