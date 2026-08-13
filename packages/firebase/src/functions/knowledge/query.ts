import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getVertexAIClient } from '../../lib/vertexClient';
import {
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_DIMENSION,
  type KnowledgeChunk,
  type KnowledgeCitation,
  type KnowledgeQueryReceipt,
  type KnowledgeDocument,
  type KnowledgeQueryRequest,
} from '@indii/shared';

if (!admin.apps.length) {
  admin.initializeApp();
}

// Query request type imported from @indii/shared

/**
 * Phase 3: queryKnowledgeBase
 * Generates a 768-dim embedding via Vertex AI text-embedding-004, executes vector search
 * using Firestore findNearest on user-isolated subcollection, returns top-K citations,
 * and logs an immutable KnowledgeQueryReceipt.
 */
export const queryKnowledgeBase = onCall({ enforceAppCheck: true }, async (request: CallableRequest<KnowledgeQueryRequest>) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to query knowledge base.');
  }

  const uid = request.auth.uid;
  const startTimeMs = Date.now();
  const { query, topK = 5, documentIdFilters } = request.data || {};

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
    const filteredChunks = Array.isArray(documentIdFilters) && documentIdFilters.length > 0
      ? chunksRef.where('documentId', 'in', documentIdFilters.slice(0, 30))
      : chunksRef;
    vectorQuerySnap = await filteredChunks.findNearest('embedding', queryEmbedding, {
      limit: k,
      distanceMeasure: 'COSINE',
    }).get();
  } catch (vectorErr: unknown) {
    const errorMsg = vectorErr instanceof Error ? vectorErr.message : String(vectorErr);
    throw new HttpsError('internal', `Vector search query failed: ${errorMsg}`);
  }

  const uniqueDocIds = [...new Set(vectorQuerySnap.docs.map(doc => (doc.data() as KnowledgeChunk).documentId))];
  const docsMap = new Map<string, string>();

  if (uniqueDocIds.length > 0) {
    const ragDocsRef = admin.firestore().collection('users').doc(uid).collection('ragDocuments');
    if (uniqueDocIds.length <= 30) {
      const docsSnap = await ragDocsRef.where(admin.firestore.FieldPath.documentId(), 'in', uniqueDocIds).get();
      docsSnap.forEach(doc => {
        docsMap.set(doc.id, (doc.data() as KnowledgeDocument).title);
      });
    } else {
      for (const id of uniqueDocIds) {
        const snap = await ragDocsRef.doc(id).get();
        if (snap.exists) docsMap.set(id, (snap.data() as KnowledgeDocument).title);
      }
    }
  }

  const citations: KnowledgeCitation[] = [];
  vectorQuerySnap.docs.forEach((doc) => {
    const chunkData = doc.data() as KnowledgeChunk;
    citations.push({
      documentId: chunkData.documentId,
      documentTitle: docsMap.get(chunkData.documentId) || 'Unknown Document',
      pageNumber: chunkData.pageNumber,
      startOffset: chunkData.startOffset,
      endOffset: chunkData.endOffset,
      relevanceScore: 1.0, // Distance cosine metric representation
      snippet: chunkData.text,
    });
  });

  const now = new Date().toISOString();
  const receiptRef = admin.firestore().collection('users').doc(uid).collection('ragQueryReceipts').doc();
  
  // 3. Generate answer using Gemini 3 Flash Preview grounded in citations
  let answer = "";
  try {
    const vertex = getVertexAIClient();
    const contextText = citations.length > 0
      ? citations.map(c => `[Document ${c.documentId}]:\n${c.snippet}`).join('\n\n')
      : "(No relevant documents found in knowledge base.)";
    
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

  const durationMs = Date.now() - startTimeMs;
  const receipt: KnowledgeQueryReceipt = {
    queryId: receiptRef.id,
    uid,
    queryText: query.trim(),
    durationMs,
    resultCount: citations.length,
    citations,
    timestamp: now,
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
