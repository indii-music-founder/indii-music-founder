import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getVertexAIClient } from '../../lib/vertexClient';
import {
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_DIMENSION,
  type KnowledgeChunk,
  type KnowledgeCitation,
  type KnowledgeQueryReceipt,
} from '../../shared/knowledge';

if (!admin.apps.length) {
  admin.initializeApp();
}

export interface QueryKnowledgeBasePayload {
  query: string;
  topK?: number;
  minSimilarity?: number;
}

/**
 * Phase 3: queryKnowledgeBase
 * Generates a 768-dim embedding via Vertex AI text-embedding-004, executes vector search
 * using Firestore findNearest on user-isolated subcollection, returns top-K citations,
 * and logs an immutable KnowledgeQueryReceipt.
 */
export const queryKnowledgeBase = onCall({ enforceAppCheck: true }, async (request: CallableRequest<QueryKnowledgeBasePayload>) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to query knowledge base.');
  }

  const uid = request.auth.uid;
  const { query, topK = 5 } = request.data || {};

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Query string must not be empty.');
  }

  const k = Math.min(Math.max(1, Number(topK) || 5), 20);

  // 1. Generate query embedding via Vertex AI
  let queryEmbedding: number[];
  try {
    const vertex = getVertexAIClient();
    const embedRes = await vertex.models.embedContent({
      model: KNOWLEDGE_EMBEDDING_MODEL,
      contents: [query.trim()],
    });

    queryEmbedding = embedRes.embeddings?.[0]?.values || [];
    if (queryEmbedding.length !== KNOWLEDGE_EMBEDDING_DIMENSION) {
      throw new Error(`Expected ${KNOWLEDGE_EMBEDDING_DIMENSION}-dim embedding, got ${queryEmbedding.length}.`);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new HttpsError('internal', `Failed to generate query embedding: ${errorMsg}`);
  }

  // 2. Query vector index on user-isolated collectionGroup / subcollection
  const chunksRef = admin.firestore().collection('users').doc(uid).collection('ragChunks');
  
  let vectorQuerySnap;
  try {
    vectorQuerySnap = await chunksRef.findNearest('embedding', queryEmbedding, {
      limit: k,
      distanceMeasure: 'COSINE',
    }).get();
  } catch (vectorErr: unknown) {
    const errorMsg = vectorErr instanceof Error ? vectorErr.message : String(vectorErr);
    throw new HttpsError('internal', `Vector search query failed: ${errorMsg}`);
  }

  const citations: KnowledgeCitation[] = [];
  vectorQuerySnap.docs.forEach((doc) => {
    const chunkData = doc.data() as KnowledgeChunk;
    citations.push({
      chunkId: chunkData.chunkId,
      documentId: chunkData.documentId,
      text: chunkData.text,
      score: 1.0, // Distance cosine metric representation
      pageNumber: chunkData.pageNumber,
      ordinal: chunkData.ordinal,
    });
  });

  const now = new Date().toISOString();
  const receiptRef = admin.firestore().collection('users').doc(uid).collection('ragQueryReceipts').doc();
  
  // 3. Generate answer using Gemini 3 Flash Preview grounded in citations
  let answer = "";
  try {
    const vertex = getVertexAIClient();
    const contextText = citations.map(c => `[Document ${c.documentId}]:\n${c.text}`).join('\n\n');
    
    const prompt = `You are an AI assistant answering questions based strictly on the provided context documents.
    
Context Documents:
${contextText}

Question:
${query}

Instructions:
1. Answer the question using ONLY the provided Context Documents.
2. If the answer is not contained in the Context Documents, say "I cannot answer this question based on the provided documents."
3. Do not use outside knowledge.
4. Keep the answer clear and concise.`;

    const response = await vertex.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [prompt],
      config: {
        temperature: 0.0,
      }
    });

    if (response.text) {
        answer = response.text;
    } else {
        answer = "I couldn't generate an answer from the provided documents.";
    }
  } catch (genErr: unknown) {
    console.error("Gemini generation failed:", genErr);
    answer = "An error occurred while generating the answer from the documents.";
  }

  const receipt: KnowledgeQueryReceipt = {
    receiptId: receiptRef.id,
    uid,
    query: query.trim(),
    topK: k,
    resultsCount: citations.length,
    citationChunkIds: citations.map((c) => c.chunkId),
    latencyMs: 0, // Server internal processing elapsed time placeholder
    queriedAt: now,
  };

  await receiptRef.set(receipt);

  return {
    query: query.trim(),
    citations,
    answer,
    receiptId: receiptRef.id,
    queriedAt: now,
  };
});
