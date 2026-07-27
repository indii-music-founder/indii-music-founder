import { describe, it, expect } from 'vitest';
import {
  KnowledgeDocumentSchema,
  KnowledgeChunkSchema,
  KnowledgeIndexReceiptSchema,
  KnowledgeQueryRequestSchema,
  KnowledgeCitationSchema,
  KnowledgeOperationErrorSchema,
  KNOWLEDGE_DOCUMENT_STATE_SCHEMA,
  KNOWLEDGE_WORKER_VERSION,
  KNOWLEDGE_EMBEDDING_MODEL,
  KNOWLEDGE_EMBEDDING_DIMENSION,
} from './knowledge';

describe('Knowledge Base Shared Schemas', () => {
  it('validates all required document states', () => {
    const validStates = [
      'uploading',
      'uploaded',
      'verifying',
      'queued',
      'indexing',
      'active',
      'failed',
      'deleting',
      'deleted',
    ];
    for (const state of validStates) {
      expect(KNOWLEDGE_DOCUMENT_STATE_SCHEMA.parse(state)).toBe(state);
    }
    expect(() => KNOWLEDGE_DOCUMENT_STATE_SCHEMA.parse('invalid_state')).toThrow();
  });

  it('validates KnowledgeDocumentSchema correctly', () => {
    const doc = {
      id: 'doc-123',
      uid: 'user-456',
      contentSha256: 'a'.repeat(64),
      storagePath: 'rag-sources/user-456/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/original.txt',
      storageGeneration: '1700000000000000',
      title: 'Sample Knowledge',
      mimeType: 'text/plain',
      byteSize: 1024,
      state: 'active',
      workerVersion: KNOWLEDGE_WORKER_VERSION,
      embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
      embeddingDimension: KNOWLEDGE_EMBEDDING_DIMENSION,
      chunkCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(KnowledgeDocumentSchema.parse(doc)).toEqual(doc);
  });

  it('rejects invalid SHA-256 in KnowledgeDocumentSchema', () => {
    const doc = {
      id: 'doc-123',
      uid: 'user-456',
      contentSha256: 'invalid-hash',
      storagePath: 'path',
      storageGeneration: '123',
      title: 'Sample',
      mimeType: 'text/plain',
      byteSize: 100,
      state: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => KnowledgeDocumentSchema.parse(doc)).toThrow();
  });

  it('validates KnowledgeChunkSchema with 768 dimensions', () => {
    const chunk = {
      chunkId: 'chunk-1',
      documentId: 'doc-123',
      uid: 'user-456',
      ordinal: 0,
      text: 'First chunk of text content.',
      startOffset: 0,
      endOffset: 28,
      embedding: new Array(768).fill(0.1),
      embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
      chunkHash: 'b'.repeat(64),
      createdAt: new Date().toISOString(),
    };
    expect(KnowledgeChunkSchema.parse(chunk)).toEqual(chunk);
  });

  it('rejects KnowledgeChunkSchema if embedding is not 768 dimensions', () => {
    const chunk = {
      chunkId: 'chunk-1',
      documentId: 'doc-123',
      uid: 'user-456',
      ordinal: 0,
      text: 'First chunk',
      startOffset: 0,
      endOffset: 11,
      embedding: new Array(512).fill(0.1), // Wrong dim
      chunkHash: 'b'.repeat(64),
      createdAt: new Date().toISOString(),
    };
    expect(() => KnowledgeChunkSchema.parse(chunk)).toThrow();
  });

  it('validates KnowledgeIndexReceiptSchema and KnowledgeQueryRequestSchema', () => {
    const receipt = {
      receiptId: 'rcpt-1',
      documentId: 'doc-123',
      uid: 'user-456',
      contentSha256: 'a'.repeat(64),
      storageGeneration: '1000',
      workerVersion: KNOWLEDGE_WORKER_VERSION,
      embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
      embeddingDimension: 768,
      chunkCount: 4,
      status: 'success',
      indexedAt: new Date().toISOString(),
    };
    expect(KnowledgeIndexReceiptSchema.parse(receipt)).toEqual(receipt);

    const queryReq = KnowledgeQueryRequestSchema.parse({
      query: 'What is indii music?',
    });
    expect(queryReq.topK).toBe(5);
    expect(queryReq.minRelevance).toBe(0.5);
  });
});
