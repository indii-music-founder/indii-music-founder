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

export interface KnowledgeDocument {
  id: string;
  uid: string;
  contentSha256: string;
  storagePath: string;
  storageGeneration: string;
  title: string;
  mimeType: 'text/plain' | 'text/markdown' | 'application/pdf';
  byteSize: number;
  state: KnowledgeDocumentState;
  workerVersion: string;
  embeddingModel: string;
  embeddingDimension: number;
  chunkCount: number;
  failureReason?: string;
  failureCode?: string;
  createdAt: string;
  updatedAt: string;
  indexedAt?: string | null;
}

export interface KnowledgeChunk {
  chunkId: string;
  documentId: string;
  uid: string;
  ordinal: number;
  text: string;
  startOffset: number;
  endOffset: number;
  pageNumber?: number;
  embedding: number[];
  embeddingModel: string;
  chunkHash: string;
  createdAt: string;
}

export interface KnowledgeIndexReceipt {
  receiptId: string;
  documentId: string;
  uid: string;
  contentSha256: string;
  storageGeneration: string;
  workerVersion: string;
  embeddingModel: string;
  embeddingDimension: number;
  chunkCount: number;
  status: 'success' | 'failed';
  failureCode?: string;
  failureReason?: string;
  indexedAt: string;
}
