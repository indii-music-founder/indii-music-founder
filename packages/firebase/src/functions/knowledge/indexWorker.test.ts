import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeDocumentIndexing } from './indexWorker';

describe('Knowledge Base Index Worker', () => {
  let mockFirestoreData: Record<string, any>;
  let mockDb: any;
  let mockStorage: any;
  let mockGenAI: any;

  beforeEach(() => {
    mockFirestoreData = {};

    const createDocRef = (path: string) => ({
      path,
      id: path.split('/').pop(),
      get: vi.fn(async () => ({
        exists: !!mockFirestoreData[path],
        data: () => mockFirestoreData[path],
      })),
      set: vi.fn(async (data: any, options?: any) => {
        if (options?.merge && mockFirestoreData[path]) {
          mockFirestoreData[path] = { ...mockFirestoreData[path], ...data };
        } else {
          mockFirestoreData[path] = data;
        }
      }),
      delete: vi.fn(async () => {
        delete mockFirestoreData[path];
      }),
      collection: (subCol: string) => createColRef(`${path}/${subCol}`),
    });

    const createColRef = (colPath: string) => ({
      doc: (docId: string) => createDocRef(`${colPath}/${docId}`),
      where: () => ({
        get: vi.fn(async () => ({
          empty: true,
          docs: [],
        })),
      }),
    });

    mockDb = {
      collection: (colPath: string) => createColRef(colPath),
      batch: () => ({
        set: vi.fn((ref: any, data: any) => {
          mockFirestoreData[ref.path] = data;
        }),
        delete: vi.fn(),
        commit: vi.fn(async () => {}),
      }),
    };

    mockStorage = {
      bucket: () => ({
        file: (path: string) => ({
          getMetadata: vi.fn(async () => [
            {
              generation: '1001',
              contentType: 'text/plain',
              name: path,
            },
          ]),
          download: vi.fn(async () => [
            Buffer.from('This is a test document content for RAG indexing.', 'utf8'),
          ]),
        }),
      }),
    };

    mockGenAI = {
      models: {
        embedContent: vi.fn(async () => ({
          embeddings: [{ values: new Array(768).fill(0.05) }],
        })),
      },
    };
  });

  it('indexes a valid uploaded text document cleanly', async () => {
    const content = 'This is a test document content for RAG indexing.';
    const contentSha256 = '81062f0cf71ccb963830343e49677f93976eb957c30b1cc163f7e6379bfd6118';

    const payload = {
      uid: 'user-123',
      documentId: 'doc-abc',
      storagePath: 'rag-sources/user-123/81062f0cf71ccb963830343e49677f93976eb957c30b1cc163f7e6379bfd6118/original.txt',
      storageGeneration: '1001',
      contentSha256,
    };

    const result = await executeDocumentIndexing(payload, {
      db: mockDb,
      storage: mockStorage,
      getGenAI: () => mockGenAI,
    });

    expect(result.documentId).toBe('doc-abc');
    expect(result.chunkCount).toBeGreaterThan(0);

    const docState = mockFirestoreData['users/user-123/ragDocuments/doc-abc'];
    expect(docState.state).toBe('active');
    expect(docState.chunkCount).toBe(result.chunkCount);

    const receipt = mockFirestoreData['users/user-123/ragReceipts/rcpt_doc-abc'];
    expect(receipt.status).toBe('success');
    expect(receipt.embeddingDimension).toBe(768);
  });

  it('is idempotent on retry if document is already active with receipt', async () => {
    const contentSha256 = '81062f0cf71ccb963830343e49677f93976eb957c30b1cc163f7e6379bfd6118';
    mockFirestoreData['users/user-123/ragReceipts/rcpt_doc-abc'] = {
      receiptId: 'rcpt_doc-abc',
      documentId: 'doc-abc',
      uid: 'user-123',
      contentSha256,
      storageGeneration: '1001',
      status: 'success',
      chunkCount: 2,
    };

    const payload = {
      uid: 'user-123',
      documentId: 'doc-abc',
      storagePath: 'rag-sources/user-123/81062f0cf71ccb963830343e49677f93976eb957c30b1cc163f7e6379bfd6118/original.txt',
      storageGeneration: '1001',
      contentSha256,
    };

    const result = await executeDocumentIndexing(payload, {
      db: mockDb,
      storage: mockStorage,
      getGenAI: () => mockGenAI,
    });

    expect(result.chunkCount).toBe(2);
    expect(mockGenAI.models.embedContent).not.toHaveBeenCalled();
  });

  it('fails closed and records failed state if SHA-256 hash mismatches', async () => {
    const payload = {
      uid: 'user-123',
      documentId: 'doc-bad',
      storagePath: 'rag-sources/user-123/wrong/original.txt',
      storageGeneration: '1001',
      contentSha256: '0000000000000000000000000000000000000000000000000000000000000000',
    };

    await expect(
      executeDocumentIndexing(payload, {
        db: mockDb,
        storage: mockStorage,
        getGenAI: () => mockGenAI,
      }),
    ).rejects.toThrow('File SHA-256 hash mismatch');

    const docState = mockFirestoreData['users/user-123/ragDocuments/doc-bad'];
    expect(docState.state).toBe('failed');
    expect(docState.failureCode).toBe('FAILED-PRECONDITION');
  });
});
