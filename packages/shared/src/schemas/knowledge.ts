import { z } from 'zod';

export const KNOWLEDGE_DOCUMENT_STATE_SCHEMA = z.enum([
  'uploading',
  'uploaded',
  'verifying',
  'queued',
  'indexing',
  'active',
  'failed',
  'deleting',
  'deleted',
]);
export type KnowledgeDocumentState = z.infer<typeof KNOWLEDGE_DOCUMENT_STATE_SCHEMA>;

export const KNOWLEDGE_WORKER_VERSION = 'v1.0.0' as const;
export const KNOWLEDGE_EMBEDDING_MODEL = 'text-embedding-004' as const;
export const KNOWLEDGE_EMBEDDING_DIMENSION = 768 as const;

export const KnowledgeDocumentSchema = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  storagePath: z.string().min(1),
  storageGeneration: z.string().min(1),
  title: z.string().min(1).max(512),
  mimeType: z.enum(['text/plain', 'text/markdown', 'application/pdf']),
  byteSize: z.number().int().nonnegative(),
  state: KNOWLEDGE_DOCUMENT_STATE_SCHEMA,
  workerVersion: z.string().default(KNOWLEDGE_WORKER_VERSION),
  embeddingModel: z.string().default(KNOWLEDGE_EMBEDDING_MODEL),
  embeddingDimension: z.number().int().default(KNOWLEDGE_EMBEDDING_DIMENSION),
  chunkCount: z.number().int().nonnegative().default(0),
  failureReason: z.string().optional(),
  failureCode: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  indexedAt: z.string().nullable().optional(),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

export const KnowledgeChunkSchema = z.object({
  chunkId: z.string().min(1),
  documentId: z.string().min(1),
  uid: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
  text: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  pageNumber: z.number().int().positive().optional(),
  embedding: z.array(z.number()).length(KNOWLEDGE_EMBEDDING_DIMENSION),
  embeddingModel: z.string().default(KNOWLEDGE_EMBEDDING_MODEL),
  chunkHash: z.string().regex(/^[a-f0-9]{64}$/i),
  createdAt: z.string(),
});
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;

export const KnowledgeIndexReceiptSchema = z.object({
  receiptId: z.string().min(1),
  documentId: z.string().min(1),
  uid: z.string().min(1),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  storageGeneration: z.string().min(1),
  workerVersion: z.string(),
  embeddingModel: z.string(),
  embeddingDimension: z.number().int(),
  chunkCount: z.number().int().nonnegative(),
  status: z.enum(['success', 'failed']),
  failureCode: z.string().optional(),
  failureReason: z.string().optional(),
  indexedAt: z.string(),
});
export type KnowledgeIndexReceipt = z.infer<typeof KnowledgeIndexReceiptSchema>;

export const KnowledgeQueryRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  documentIdFilters: z.array(z.string()).optional(),
  topK: z.number().int().positive().max(20).default(5),
  minRelevance: z.number().min(0).max(1).default(0.5),
});
export type KnowledgeQueryRequest = z.infer<typeof KnowledgeQueryRequestSchema>;

export const KnowledgeCitationSchema = z.object({
  documentId: z.string().min(1),
  documentTitle: z.string().min(1),
  pageNumber: z.number().int().positive().optional(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  relevanceScore: z.number().min(0).max(1),
  snippet: z.string(),
});
export type KnowledgeCitation = z.infer<typeof KnowledgeCitationSchema>;

export const KnowledgeQueryReceiptSchema = z.object({
  queryId: z.string().min(1),
  uid: z.string().min(1),
  queryText: z.string(),
  durationMs: z.number().nonnegative(),
  resultCount: z.number().int().nonnegative(),
  citations: z.array(KnowledgeCitationSchema),
  timestamp: z.string(),
});
export type KnowledgeQueryReceipt = z.infer<typeof KnowledgeQueryReceiptSchema>;

export const KnowledgeOperationErrorSchema = z.object({
  code: z.enum([
    'INVALID_REQUEST',
    'UNAUTHENTICATED',
    'UNAUTHORIZED',
    'DOCUMENT_NOT_FOUND',
    'INCOMPATIBLE_STATE',
    'FILE_TOO_LARGE',
    'UNEXTRACTABLE_DOCUMENT',
    'RATE_LIMITED',
    'SERVICE_UNAVAILABLE',
  ]),
  message: z.string(),
  statusCode: z.number().int(),
  details: z.record(z.unknown()).optional(),
});
export type KnowledgeOperationError = z.infer<typeof KnowledgeOperationErrorSchema>;

export const CreateKnowledgeUploadRequestSchema = z.object({
  title: z.string().min(1).max(512),
  mimeType: z.enum(['text/plain', 'text/markdown', 'application/pdf']),
  byteSize: z.number().int().nonnegative(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  ext: z.string().optional(),
});
export type CreateKnowledgeUploadRequest = z.infer<typeof CreateKnowledgeUploadRequestSchema>;

export const FinalizeKnowledgeUploadRequestSchema = z.object({
  documentId: z.string().min(1),
});
export type FinalizeKnowledgeUploadRequest = z.infer<typeof FinalizeKnowledgeUploadRequestSchema>;

export const DeleteKnowledgeDocumentRequestSchema = z.object({
  documentId: z.string().min(1),
});
export type DeleteKnowledgeDocumentRequest = z.infer<typeof DeleteKnowledgeDocumentRequestSchema>;

export const IndexWorkerPayloadSchema = z.object({
  uid: z.string().min(1),
  documentId: z.string().min(1),
  storagePath: z.string().min(1),
  storageGeneration: z.string().min(1),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
});
export type IndexWorkerPayload = z.infer<typeof IndexWorkerPayloadSchema>;
