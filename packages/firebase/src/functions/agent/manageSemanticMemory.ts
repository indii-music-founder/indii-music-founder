
import * as admin from 'firebase-admin';
import { getVertexAIClient } from '../../lib/vertexClient';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { validateAppCheckV2 } from '../../middleware/appCheck';

const DEFAULT_SEMANTIC_SEARCH_LIMIT = 5;
const MAX_SEMANTIC_SEARCH_LIMIT = 100; // Increased from 20 to support full-archive recall (ISSUE-757)
const MAX_SEMANTIC_TEXT_LENGTH = 4_000;
const SEMANTIC_EMBEDDING_MODEL = 'text-embedding-004';

function assertFirestoreVectorWriteAvailable(): void {
    const hasVectorFieldValue = typeof (FieldValue as { vector?: unknown }).vector === 'function';

    if (!hasVectorFieldValue) {
        throw new HttpsError(
            'unavailable',
            'Firestore vector writes are not available in this deployment.'
        );
    }
}

function assertFirestoreVectorSearchAvailable(memoriesRef: { findNearest?: unknown }): void {
    const hasNearestSearch = typeof memoriesRef.findNearest === 'function';

    if (!hasNearestSearch) {
        throw new HttpsError(
            'unavailable',
            'Firestore vector search is not available in this deployment.'
        );
    }
}

function normalizeSemanticSearchLimit(limit: unknown): number {
    if (limit === undefined) {
        return DEFAULT_SEMANTIC_SEARCH_LIMIT;
    }

    if (typeof limit !== 'number' && typeof limit !== 'string') {
        throw new HttpsError('invalid-argument', 'Search limit must be a positive integer.');
    }

    const numericLimit = typeof limit === 'number' ? limit : Number(limit);
    if (!Number.isFinite(numericLimit) || numericLimit <= 0 || !Number.isInteger(numericLimit)) {
        throw new HttpsError('invalid-argument', 'Search limit must be a positive integer.');
    }

    return Math.min(numericLimit, MAX_SEMANTIC_SEARCH_LIMIT);
}

function normalizeSemanticText(value: unknown, fieldName: 'memory' | 'query'): string {
    if (typeof value !== 'string') {
        throw new HttpsError('invalid-argument', `Missing or invalid ${fieldName} string.`);
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        throw new HttpsError('invalid-argument', `${fieldName} cannot be empty.`);
    }

    if (trimmed.length > MAX_SEMANTIC_TEXT_LENGTH) {
        throw new HttpsError(
            'invalid-argument',
            `${fieldName} exceeds the maximum length of ${MAX_SEMANTIC_TEXT_LENGTH} characters.`
        );
    }

    return trimmed;
}

function normalizeEmbeddingVector(values: unknown, fieldName: 'memory' | 'query'): number[] {
    if (!Array.isArray(values) || values.length === 0) {
        throw new HttpsError('internal', `Failed to generate embedding vector for ${fieldName}.`);
    }

    const normalized = values.map((value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new HttpsError('internal', `Embedding vector for ${fieldName} contains an invalid value.`);
        }
        return value;
    });

    return normalized;
}

async function generateSemanticEmbedding(
    genai: ReturnType<typeof getVertexAIClient>,
    contents: string,
    fieldName: 'memory' | 'query'
): Promise<number[]> {
    const embedResponse = await genai.models.embedContent({
        model: SEMANTIC_EMBEDDING_MODEL,
        contents,
    });

    return normalizeEmbeddingVector(embedResponse.embeddings?.[0]?.values, fieldName);
}

function normalizeSemanticAction(value: unknown): 'add' | 'search' {
    if (typeof value !== 'string') {
        throw new HttpsError('invalid-argument', 'Missing action (add or search).');
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'add' || normalized === 'search') {
        return normalized;
    }

    throw new HttpsError('invalid-argument', 'Unknown action. Use "add" or "search".');
}

/**
 * Callable function to manage semantic memory (Add or Search).
 * Provides a backend proxy to Vertex AI embeddings and the current Firestore vector-search API surface.
 */
export const manageSemanticMemory = onCall({ 
    timeoutSeconds: 60, 
    memory: '512MiB', 
    enforceAppCheck: false 
}, async (request) => {
    validateAppCheckV2(request);
    
    // Require authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const userId = request.auth.uid;

    try {
        const data = request.data as unknown;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new HttpsError('invalid-argument', 'Request data must be an object.');
        }

        const { action, memory, query, limit } = data as {
            action?: unknown;
            memory?: unknown;
            query?: unknown;
            limit?: unknown;
        };

        const normalizedAction = normalizeSemanticAction(action);

        const db = admin.firestore();
        const genai = getVertexAIClient();
        const memoriesRef = db.collection('users').doc(userId).collection('memories');

        if (normalizedAction === 'add') {
            const normalizedMemory = normalizeSemanticText(memory, 'memory');
            assertFirestoreVectorWriteAvailable();

            const embeddingVector = await generateSemanticEmbedding(genai, normalizedMemory, 'memory');

            // Use the native FieldValue.vector extension for Firestore when the SDK supports it.
            const newMemRef = memoriesRef.doc();
            await newMemRef.set({
                id: newMemRef.id,
                memory: normalizedMemory,
                // FieldValue.vector is available when the current firebase-admin release supports it.
                embedding: FieldValue.vector(embeddingVector),
                created_at: FieldValue.serverTimestamp(),
                updated_at: FieldValue.serverTimestamp()
            });

            return {
                results: [{
                    id: newMemRef.id,
                    memory: normalizedMemory,
                    created_at: new Date().toISOString()
                }]
            };

        } else if (normalizedAction === 'search') {
            const normalizedQuery = normalizeSemanticText(query, 'query');
            const searchLimit = normalizeSemanticSearchLimit(limit);
            assertFirestoreVectorSearchAvailable(memoriesRef);

            const queryVector = await generateSemanticEmbedding(genai, normalizedQuery, 'query');

            // Perform vector search with +1 to detect if more results exist (pagination support)
            // findNearest is available in the current firebase-admin SDK line used by this repo.
            const vectorQuery = memoriesRef.findNearest(
                'embedding',
                queryVector,
                {
                    limit: searchLimit + 1, // +1 to detect more results
                    distanceMeasure: 'COSINE'
                }
            );

            const snapshot = await vectorQuery.get();
            const docs = snapshot.docs;

            // Check if there are more results beyond our limit
            const hasMore = docs.length > searchLimit;
            const limitedDocs = hasMore ? docs.slice(0, searchLimit) : docs;

            const results = limitedDocs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    memory: data.memory,
                    created_at: data.created_at?.toDate?.()?.toISOString() || null
                };
            });

            return {
                results,
                hasMore // Return pagination indicator for agent to know if more results exist
            };
        }

        throw new HttpsError('invalid-argument', 'Unknown action. Use "add" or "search".');

    } catch (error: unknown) {
        if (error instanceof HttpsError) {
            throw error;
        }

        console.error('[manageSemanticMemory] Unexpected error:', error);
        const message = error instanceof Error ? error.message : String(error);
        throw new HttpsError('internal', `Memory operation failed: ${message}`);
    }
});

/**
 * ISSUE-1377: server-side batch embedding for the client memory pipeline.
 * The browser-side Firebase AI embeddings are disabled by design (fail-closed
 * in EmbeddingGenerator), so agent memory ingestion/search ran with empty
 * vectors — semantic recall silently returned nothing. This endpoint proxies
 * text-embedding-004 so the client's memory records keep their richer shape
 * while vectors are computed where they can be.
 */
export const batchEmbedText = onCall({
    timeoutSeconds: 60,
    memory: '512MiB',
    enforceAppCheck: false,
}, async (request) => {
    validateAppCheckV2(request);
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const data = request.data as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new HttpsError('invalid-argument', 'Request data must be an object.');
    }

    const { texts } = data as { texts?: unknown };
    if (!Array.isArray(texts) || texts.length === 0 || texts.length > 20) {
        throw new HttpsError('invalid-argument', 'texts must be an array of 1-20 strings.');
    }

    try {
        const genai = getVertexAIClient();
        const embeddings: number[][] = [];
        for (const text of texts) {
            const normalized = normalizeSemanticText(text, 'memory');
            embeddings.push(await generateSemanticEmbedding(genai, normalized, 'memory'));
        }
        return { embeddings };
    } catch (error: unknown) {
        if (error instanceof HttpsError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new HttpsError('internal', `Batch embedding failed: ${message}`);
    }
});
