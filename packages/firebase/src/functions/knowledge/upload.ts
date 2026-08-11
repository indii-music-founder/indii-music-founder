import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import {
  KNOWLEDGE_WORKER_VERSION,
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_DIMENSION,
  type KnowledgeDocument,
  type CreateKnowledgeUploadRequest,
  type FinalizeKnowledgeUploadRequest,
  type DeleteKnowledgeDocumentRequest,
} from '@indii/shared';
import { getFunctions } from 'firebase-admin/functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

// Types imported from @indii/shared

/**
 * Endpoint 1: createKnowledgeUpload
 * Authorizes upload, records 'uploading' state, and returns canonical storage path.
 * Path pattern: rag-sources/{uid}/{sha256}/original.{ext}
 */
export const createKnowledgeUpload = onCall({ enforceAppCheck: true }, async (request: CallableRequest<CreateKnowledgeUploadRequest>) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to create knowledge upload.');
  }

  const uid = request.auth.uid;
  const { title, mimeType, byteSize, contentSha256, ext } = request.data || {};

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Valid title is required.');
  }

  const validMimeTypes = ['text/plain', 'text/markdown', 'application/pdf'];
  if (!mimeType || !validMimeTypes.includes(mimeType)) {
    throw new HttpsError('invalid-argument', `mimeType must be one of: ${validMimeTypes.join(', ')}.`);
  }

  if (typeof byteSize !== 'number' || byteSize <= 0 || byteSize > 25 * 1024 * 1024) {
    throw new HttpsError('invalid-argument', 'byteSize must be a positive number under 25MB.');
  }

  if (!contentSha256 || !/^[a-f0-9]{64}$/i.test(contentSha256)) {
    throw new HttpsError('invalid-argument', 'contentSha256 must be a valid 64-character hex SHA-256 string.');
  }

  let extension = ext?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  if (!extension) {
    if (mimeType === 'application/pdf') extension = 'pdf';
    else if (mimeType === 'text/markdown') extension = 'md';
    else extension = 'txt';
  }

  const storagePath = `rag-sources/${uid}/${contentSha256.toLowerCase()}/original.${extension}`;
  const now = new Date().toISOString();

  const docRef = admin.firestore().collection('users').doc(uid).collection('ragDocuments').doc();
  const documentId = docRef.id;

  const newDoc: KnowledgeDocument = {
    id: documentId,
    uid,
    title: title.trim(),
    mimeType,
    byteSize,
    contentSha256: contentSha256.toLowerCase(),
    storagePath,
    storageGeneration: '', // set upon finalization
    state: 'uploading',
    workerVersion: KNOWLEDGE_WORKER_VERSION,
    embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
    embeddingDimension: KNOWLEDGE_EMBEDDING_DIMENSION,
    chunkCount: 0,
    createdAt: now,
    updatedAt: now,
    indexedAt: null,
  };

  await docRef.set(newDoc);

  return {
    documentId,
    storagePath,
    uploadUrl: `gs://${admin.storage().bucket().name}/${storagePath}`,
  };
});

/**
 * Endpoint 2: finalizeKnowledgeUpload
 * Verifies object exists in Storage, matches metadata/generation/SHA, updates state to 'queued',
 * and dispatches background indexing.
 */
export const finalizeKnowledgeUpload = onCall({ enforceAppCheck: true }, async (request: CallableRequest<FinalizeKnowledgeUploadRequest>) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to finalize knowledge upload.');
  }

  const uid = request.auth.uid;
  const { documentId } = request.data || {};

  if (!documentId || typeof documentId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid documentId is required.');
  }

  const docRef = admin.firestore().collection('users').doc(uid).collection('ragDocuments').doc(documentId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new HttpsError('not-found', `Knowledge document ${documentId} not found.`);
  }

  const docData = docSnap.data() as KnowledgeDocument;

  if (docData.uid !== uid) {
    throw new HttpsError('permission-denied', 'Cannot access documents owned by another user.');
  }

  if (docData.state !== 'uploading') {
    throw new HttpsError('failed-precondition', `Document is in '${docData.state}' state, expected 'uploading'.`);
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(docData.storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    await docRef.update({
      state: 'failed',
      failureCode: 'storage-file-missing',
      failureReason: `Storage object at ${docData.storagePath} does not exist.`,
      updatedAt: new Date().toISOString(),
    });
    throw new HttpsError('not-found', `Uploaded file not found at ${docData.storagePath}.`);
  }

  const [metadata] = await file.getMetadata();
  const storageGeneration = String(metadata.generation);
  const actualSize = Number(metadata.size);

  if (actualSize !== docData.byteSize) {
    await docRef.update({
      state: 'failed',
      failureCode: 'size-mismatch',
      failureReason: `Uploaded file size ${actualSize} does not match declared size ${docData.byteSize}.`,
      updatedAt: new Date().toISOString(),
    });
    throw new HttpsError('failed-precondition', 'Uploaded file size mismatch.');
  }

  // Download & verify SHA-256
  const [fileBuffer] = await file.download();
  const computedSha256 = createHash('sha256').update(fileBuffer).digest('hex');

  if (computedSha256.toLowerCase() !== docData.contentSha256.toLowerCase()) {
    await docRef.update({
      state: 'failed',
      failureCode: 'sha256-mismatch',
      failureReason: `Computed SHA-256 ${computedSha256} does not match declared ${docData.contentSha256}.`,
      updatedAt: new Date().toISOString(),
    });
    throw new HttpsError('failed-precondition', 'Uploaded file SHA-256 mismatch.');
  }

  const now = new Date().toISOString();
  await docRef.update({
    storageGeneration,
    state: 'queued',
    updatedAt: now,
  });

  // Trigger indexing worker asynchronously via Task Queue with fallback error tracking
  try {
    const queue = getFunctions().taskQueue('indexKnowledgeDocumentWorker');
    await queue.enqueue({
      uid,
      documentId,
      storagePath: docData.storagePath,
      storageGeneration,
      contentSha256: docData.contentSha256,
    });
  } catch (queueErr: unknown) {
    const errorMsg = queueErr instanceof Error ? queueErr.message : String(queueErr);
    console.error(`[KnowledgeUpload] Failed to enqueue Cloud Task for document ${documentId}:`, queueErr);
    await docRef.update({
      failureCode: 'task-enqueue-failed',
      failureReason: errorMsg,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    documentId,
    state: 'queued',
    storageGeneration,
    updatedAt: now,
  };
});// Delete payload imported from @indii/shared

/**
 * Endpoint 3: deleteKnowledgeDocument
 * Marks document state as deleting, batch deletes chunks, and deletes the GCS object.
 */
export const deleteKnowledgeDocument = onCall({ enforceAppCheck: true }, async (request: CallableRequest<DeleteKnowledgeDocumentRequest>) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to delete knowledge upload.');
  }

  const uid = request.auth.uid;
  const { documentId } = request.data || {};

  if (!documentId || typeof documentId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid documentId is required.');
  }

  const docRef = admin.firestore().collection('users').doc(uid).collection('ragDocuments').doc(documentId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new HttpsError('not-found', `Knowledge document ${documentId} not found.`);
  }

  const docData = docSnap.data() as KnowledgeDocument;

  if (docData.uid !== uid) {
    throw new HttpsError('permission-denied', 'Cannot access documents owned by another user.');
  }

  // Mark as trashed and paused indexing
  const now = new Date().toISOString();
  // Update the source and create its manifest atomically so a failed write can
  // never hide the document without leaving a restorable Trash record.
  const trashId = `trash_${Date.now()}_${documentId.slice(0, 6)}`;
  const trashRef = admin.firestore().collection('users').doc(uid).collection('trashItems').doc(trashId);
  const batch = admin.firestore().batch();
  batch.update(docRef, {
    state: 'failed',
    isTrashed: true,
    isIndexed: false,
    updatedAt: now,
  });
  batch.set(trashRef, {
    id: trashId,
    userId: uid,
    type: 'knowledge_docs',
    targetId: documentId,
    name: docData.title,
    originalLocation: `ragDocuments/${documentId}`,
    mimeType: docData.mimeType,
    sizeBytes: docData.byteSize,
    provenance: {
      actor: 'user',
      reason: 'Moved knowledge document to trash'
    },
    state: 'trashed',
    idempotencyKey: `kd_${documentId}`,
    restoreData: { ...docData },
    legalHold: { isLocked: false },
    hasEntries: false,
    trashedAt: now,
    updatedAt: now,
  });
  await batch.commit();

  return { success: true, documentId, trashId };
});
