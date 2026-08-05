import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { getVertexAIClient } from '../../lib/vertexClient';
import { requireVerifiedServerEntitlement } from '../auth/entitlements';
import { extractDocumentText } from './textExtractor';
import { chunkDocumentPages, type GeneratedChunk } from './chunker';
import {
  KNOWLEDGE_WORKER_VERSION,
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_DIMENSION,
  type KnowledgeIndexReceipt,
  type IndexWorkerPayload,
} from '@indii/shared';

// IndexWorkerPayload imported from @indii/shared

/**
 * Private indexing worker logic.
 * Download exact GCS generation, verify SHA-256, parse text, chunk deterministically,
 * generate 768-dim Vertex embeddings, batch write chunks, and transition document to active.
 */
export async function executeDocumentIndexing(
  payload: IndexWorkerPayload,
  dependencies: {
    db?: admin.firestore.Firestore;
    storage?: admin.storage.Storage;
    getGenAI?: () => ReturnType<typeof getVertexAIClient>;
    requireVerifiedEntitlement?: (uid: string) => Promise<unknown>;
  } = {},
): Promise<{ documentId: string; chunkCount: number; receiptId: string }> {
  const { uid, documentId, storagePath, storageGeneration, contentSha256 } = payload;

  if (!uid || !documentId || !storagePath || !storageGeneration || !contentSha256) {
    throw new HttpsError('invalid-argument', 'Missing required indexing parameters.');
  }

  const db = dependencies.db ?? admin.firestore();
  const storage = dependencies.storage ?? admin.storage();
  const getGenAI = dependencies.getGenAI ?? (() => getVertexAIClient());

  const docRef = db.collection('users').doc(uid).collection('ragDocuments').doc(documentId);
  const receiptRef = db.collection('users').doc(uid).collection('ragReceipts').doc(`rcpt_${documentId}`);

  // Idempotency check: Return early if indexing already completed
  const receiptSnap = await receiptRef.get();
  if (receiptSnap.exists) {
    const data = receiptSnap.data() as KnowledgeIndexReceipt;
    if (data.status === 'success' && data.contentSha256 === contentSha256) {
      console.info(`[KnowledgeWorker] Document ${documentId} already indexed. Idempotent early return.`);
      return { documentId, chunkCount: data.chunkCount, receiptId: receiptRef.id };
    }
  }

  const requireVerifiedEntitlement = dependencies.requireVerifiedEntitlement ?? requireVerifiedServerEntitlement;

  // Entitlement check
  await requireVerifiedEntitlement(uid);

  // Load canonical owner record and verify state
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new HttpsError('not-found', `Knowledge document ${documentId} not found.`);
  }
  const docData = docSnap.data() as Record<string, unknown>;
  if (docData.storagePath !== storagePath || docData.storageGeneration !== storageGeneration || docData.contentSha256 !== contentSha256) {
    throw new HttpsError('failed-precondition', `Document metadata mismatch for ${documentId}.`);
  }
  if (docData.state !== 'queued' && docData.state !== 'indexing') {
    throw new HttpsError('failed-precondition', `Document is in incompatible state: ${docData.state}`);
  }

  // Update document state to 'indexing'
  const nowIso = new Date().toISOString();
  await docRef.set(
    {
      state: 'indexing',
      updatedAt: nowIso,
      workerVersion: KNOWLEDGE_WORKER_VERSION,
      embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
      embeddingDimension: KNOWLEDGE_EMBEDDING_DIMENSION,
    },
    { merge: true },
  );

  try {
    // 1. Fetch exact GCS file & generation
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);

    const [metadata] = await file.getMetadata();
    const actualGen = String(metadata.generation || '');
    if (storageGeneration && actualGen && actualGen !== storageGeneration) {
      throw new HttpsError(
        'failed-precondition',
        `Storage generation mismatch. Expected ${storageGeneration}, got ${actualGen}.`,
      );
    }

    // 2. Download exact generation bytes
    const [fileBuffer] = await file.download();

    // 3. Recompute SHA-256 hash before extraction
    const computedSha256 = createHash('sha256').update(fileBuffer).digest('hex');
    if (computedSha256.toLowerCase() !== contentSha256.toLowerCase()) {
      throw new HttpsError(
        'failed-precondition',
        `File SHA-256 hash mismatch. Expected ${contentSha256}, computed ${computedSha256}.`,
      );
    }

    // 4. Extract document text
    const mimeType = String(metadata.contentType || 'text/plain');
    const fileName = String(metadata.name || 'original.txt');
    const extraction = await extractDocumentText(fileBuffer, mimeType, fileName);

    // 5. Chunk text deterministically
    const chunks = chunkDocumentPages(documentId, uid, extraction.pages);

    if (chunks.length === 0) {
      throw new HttpsError('failed-precondition', 'Zero text chunks generated from document.');
    }

    // 6. Generate 768-dim Vertex embeddings using ADC
    const genai = getGenAI();
    const embeddedChunks: (GeneratedChunk & { embedding: number[] })[] = [];

    for (const chunk of chunks) {
      const embedResponse = await genai.models.embedContent({
        model: KNOWLEDGE_EMBEDDING_MODEL,
        contents: chunk.text,
        config: {
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: KNOWLEDGE_EMBEDDING_DIMENSION,
        },
      });

      const values = embedResponse.embeddings?.[0]?.values;
      if (!values || values.length !== KNOWLEDGE_EMBEDDING_DIMENSION) {
        throw new HttpsError(
          'internal',
          `Vertex AI embedding returned invalid dimension. Expected 768, got ${values?.length || 0}.`,
        );
      }

      embeddedChunks.push({
        ...chunk,
        embedding: values,
      });
    }

    // 7. Write chunks to users/{uid}/ragChunks in batches
    const chunksCol = db.collection('users').doc(uid).collection('ragChunks');

    // Clear any existing stale chunks for this document first (idempotent cleanup)
    const existingChunksSnap = await chunksCol.where('documentId', '==', documentId).get();
    if (!existingChunksSnap.empty) {
      const deleteBatch = db.batch();
      existingChunksSnap.docs.forEach((docSnap) => deleteBatch.delete(docSnap.ref));
      await deleteBatch.commit();
    }

    const batchSize = 250;
    for (let i = 0; i < embeddedChunks.length; i += batchSize) {
      const batch = db.batch();
      const currentBatch = embeddedChunks.slice(i, i + batchSize);
      for (const item of currentBatch) {
        const chunkRef = chunksCol.doc(item.chunkId);
        batch.set(chunkRef, {
          chunkId: item.chunkId,
          documentId: item.documentId,
          uid: item.uid,
          ordinal: item.ordinal,
          text: item.text,
          startOffset: item.startOffset,
          endOffset: item.endOffset,
          ...(item.pageNumber ? { pageNumber: item.pageNumber } : {}),
          embedding: item.embedding,
          embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
          chunkHash: item.chunkHash,
          createdAt: nowIso,
        });
      }
      await batch.commit();
    }

    // 8. Update document state to 'active' & write success receipt
    const finishedAtIso = new Date().toISOString();
    await docRef.set(
      {
        state: 'active',
        chunkCount: embeddedChunks.length,
        indexedAt: finishedAtIso,
        updatedAt: finishedAtIso,
        failureReason: admin.firestore.FieldValue.delete(),
        failureCode: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );

    const successReceipt: KnowledgeIndexReceipt = {
      receiptId: receiptRef.id,
      documentId,
      uid,
      contentSha256,
      storageGeneration,
      workerVersion: KNOWLEDGE_WORKER_VERSION,
      embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
      embeddingDimension: KNOWLEDGE_EMBEDDING_DIMENSION,
      chunkCount: embeddedChunks.length,
      status: 'success',
      indexedAt: finishedAtIso,
    };
    await receiptRef.set(successReceipt);

    console.info(
      `[KnowledgeWorker] Successfully indexed document ${documentId} (${embeddedChunks.length} chunks).`,
    );
    return { documentId, chunkCount: embeddedChunks.length, receiptId: receiptRef.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const failureCode =
      err instanceof HttpsError ? err.code.toUpperCase() : 'INDEXING_FAILED';
    const failedAtIso = new Date().toISOString();

    console.error(`[KnowledgeWorker] Indexing document ${documentId} failed: ${errorMsg}`);

    // Update document state to 'failed' (never leave partial/active state)
    await docRef.set(
      {
        state: 'failed',
        failureReason: errorMsg,
        failureCode,
        updatedAt: failedAtIso,
      },
      { merge: true },
    );

    // Record durable failed receipt
    const failedReceipt: KnowledgeIndexReceipt = {
      receiptId: receiptRef.id,
      documentId,
      uid,
      contentSha256,
      storageGeneration,
      workerVersion: KNOWLEDGE_WORKER_VERSION,
      embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
      embeddingDimension: KNOWLEDGE_EMBEDDING_DIMENSION,
      chunkCount: 0,
      status: 'failed',
      failureCode,
      failureReason: errorMsg,
      indexedAt: failedAtIso,
    };
    await receiptRef.set(failedReceipt);

    throw err;
  }
}

/**
 * Cloud Function worker trigger for async indexing.
 */
export const indexKnowledgeDocumentWorker = onTaskDispatched(
  {
    retryConfig: { maxAttempts: 3 },
    rateLimits: { maxConcurrentDispatches: 10 },
    region: 'us-central1', 
    timeoutSeconds: 300, 
    memory: '1GiB'
  },
  async (request) => {
    const { uid, documentId, storagePath, storageGeneration, contentSha256 } = request.data as IndexWorkerPayload;
    
    await executeDocumentIndexing({
      uid,
      documentId,
      storagePath,
      storageGeneration,
      contentSha256,
    });
  }
);
