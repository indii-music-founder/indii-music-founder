import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getVertexAIClient } from '../../lib/vertexClient';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';

const ENFORCE_APP_CHECK = process.env.NODE_ENV === 'production' && process.env.SKIP_APP_CHECK !== "true" && process.env.ENFORCE_APP_CHECK !== "false";

/**
 * Callable function to manage semantic memory (Add or Search).
 * Provides a backend proxy to Vertex AI Embeddings and Firestore Vector Search.
 */
export const manageSemanticMemory = onCall({ 
    timeoutSeconds: 60, 
    memory: '256MiB', 
    enforceAppCheck: ENFORCE_APP_CHECK 
}, async (request) => {
    
    // Require authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { action, memory, query, limit = 5 } = request.data;
    const userId = request.auth.uid;

    if (!action) {
        throw new HttpsError('invalid-argument', 'Missing action (add or search).');
    }

    const db = admin.firestore();
    const genai = getVertexAIClient();

    try {
        if (action === 'add') {
            if (!memory || typeof memory !== 'string') {
                throw new HttpsError('invalid-argument', 'Missing or invalid memory string.');
            }

            // Generate Embedding
            const embedResponse = await genai.models.embedContent({
                model: 'text-embedding-004',
                contents: memory,
            });

            const embeddingVector = embedResponse.embeddings?.[0]?.values;
            
            if (!embeddingVector) {
                throw new Error('Failed to generate embedding vector.');
            }

            // Use the native FieldValue.vector extension for Firestore
            const newMemRef = db.collection('users').doc(userId).collection('memories').doc();
            await newMemRef.set({
                id: newMemRef.id,
                memory: memory,
                // @ts-expect-error FieldValue.vector is available in the latest firebase-admin
                embedding: FieldValue.vector(embeddingVector),
                created_at: FieldValue.serverTimestamp(),
                updated_at: FieldValue.serverTimestamp()
            });

            return {
                results: [{
                    id: newMemRef.id,
                    memory: memory,
                    created_at: new Date().toISOString()
                }]
            };

        } else if (action === 'search') {
            if (!query || typeof query !== 'string') {
                throw new HttpsError('invalid-argument', 'Missing or invalid query string.');
            }

            // Generate Embedding for the query
            const embedResponse = await genai.models.embedContent({
                model: 'text-embedding-004',
                contents: query,
            });

            const queryVector = embedResponse.embeddings?.[0]?.values;
            
            if (!queryVector) {
                throw new Error('Failed to generate embedding vector for query.');
            }

            const memoriesRef = db.collection('users').doc(userId).collection('memories');
            
            // Perform vector search
            // @ts-expect-error findNearest is available in the latest firebase-admin SDK
            const vectorQuery = memoriesRef.findNearest('embedding', FieldValue.vector(queryVector), {
                limit: limit,
                distanceMeasure: 'COSINE'
            });

            const snapshot = await vectorQuery.get();
            const results = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    memory: data.memory,
                    created_at: data.created_at?.toDate?.()?.toISOString() || null
                };
            });

            return { results };

        } else {
            throw new HttpsError('invalid-argument', 'Unknown action. Use "add" or "search".');
        }

    } catch (error: any) {
        console.error('[manageSemanticMemory] Error:', error);
        throw new HttpsError('internal', `Memory operation failed: ${error.message || String(error)}`);
    }
});
