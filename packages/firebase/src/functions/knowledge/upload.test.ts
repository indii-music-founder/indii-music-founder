import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn();
  const mockDoc = vi.fn();
  const mockSubCollection = vi.fn().mockReturnValue({ doc: mockDoc });

  mockDoc.mockReturnValue({
    id: 'mock-doc-123',
    set: mockSet,
    update: mockUpdate,
    get: mockGet,
    collection: mockSubCollection,
  });

  const mockCollection = vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue({
      collection: mockSubCollection,
    }),
  });

  const mockFirestore = () => ({ collection: mockCollection });

  const mockFileExists = vi.fn();
  const mockFileGetMetadata = vi.fn();
  const mockFileDownload = vi.fn();
  const mockBucketObj = {
    name: 'indii-rag-bucket',
    file: vi.fn().mockReturnValue({
      exists: mockFileExists,
      getMetadata: mockFileGetMetadata,
      download: mockFileDownload,
    }),
  };
  const mockBucket = vi.fn().mockReturnValue(mockBucketObj);
  const mockStorage = Object.assign(() => ({ bucket: mockBucket }), { bucket: mockBucket });

  const mockEmbedContent = vi.fn();
  const mockGetVertexAIClient = vi.fn().mockReturnValue({
    models: { embedContent: mockEmbedContent },
  });

  const mockEnqueue = vi.fn().mockResolvedValue(undefined);
  const mockTaskQueue = vi.fn().mockReturnValue({ enqueue: mockEnqueue });
  const mockGetFunctions = vi.fn().mockReturnValue({ taskQueue: mockTaskQueue });

  return {
    mockSet,
    mockUpdate,
    mockGet,
    mockDoc,
    mockCollection,
    mockSubCollection,
    mockFirestore,
    mockFileExists,
    mockFileGetMetadata,
    mockFileDownload,
    mockBucket,
    mockStorage,
    mockEmbedContent,
    mockGetVertexAIClient,
    mockEnqueue,
    mockTaskQueue,
    mockGetFunctions,
  };
});

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: unknown) => (handler ? handler : _opts),
  HttpsError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: vi.fn(),
  firestore: mocks.mockFirestore,
  storage: mocks.mockStorage,
}));

vi.mock('firebase-admin/functions', () => ({
  getFunctions: mocks.mockGetFunctions,
}));

vi.mock('../../lib/vertexClient', () => ({
  getVertexAIClient: mocks.mockGetVertexAIClient,
}));

vi.mock('./indexWorker', () => ({
  executeDocumentIndexing: vi.fn().mockResolvedValue(undefined),
}));

import { createKnowledgeUpload, finalizeKnowledgeUpload } from './upload';

describe('Knowledge Base Upload Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSubCollection.mockReturnValue({ doc: mocks.mockDoc });
    mocks.mockDoc.mockReturnValue({
      id: 'mock-doc-123',
      set: mocks.mockSet,
      update: mocks.mockUpdate,
      get: mocks.mockGet,
      collection: mocks.mockSubCollection,
    });
  });

  describe('createKnowledgeUpload', () => {
    it('creates an uploading knowledge document with canonical path', async () => {
      const sha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const handler = createKnowledgeUpload as any;
      const res = await handler({
        auth: { uid: 'user-1' },
        data: {
          title: '   Test Doc   ',
          mimeType: 'text/markdown',
          byteSize: 1024,
          contentSha256: sha,
        },
      });

      expect(res.documentId).toBe('mock-doc-123');
      expect(res.storagePath).toBe(`rag-sources/user-1/${sha}/original.md`);
      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'user-1',
          title: 'Test Doc',
          mimeType: 'text/markdown',
          state: 'uploading',
          contentSha256: sha,
        })
      );
    });

    it('rejects unauthenticated requests', async () => {
      const handler = createKnowledgeUpload as any;
      await expect(
        handler({ auth: null, data: {} })
      ).rejects.toThrow('User must be authenticated');
    });
  });

  describe('finalizeKnowledgeUpload', () => {
    it('verifies upload and transitions state to queued', async () => {
      const sha = 'a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447';
      mocks.mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          uid: 'user-1',
          byteSize: 13,
          contentSha256: sha,
          storagePath: `rag-sources/user-1/${sha}/original.txt`,
          state: 'uploading',
        }),
      });

      mocks.mockFileExists.mockResolvedValue([true]);
      mocks.mockFileGetMetadata.mockResolvedValue([{ generation: '1700000000', size: 13 }]);
      mocks.mockFileDownload.mockResolvedValue([Buffer.from('hello world\n')]);

      const handler = finalizeKnowledgeUpload as any;
      const res = await handler({
        auth: { uid: 'user-1' },
        data: { documentId: 'doc-123' },
      });

      expect(res.state).toBe('queued');
      expect(res.storageGeneration).toBe('1700000000');
      expect(mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'queued',
          storageGeneration: '1700000000',
        })
      );
    });
  });
});
