import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn();
  const mockFindNearest = vi.fn().mockReturnValue({ get: mockGet });
  const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
  const mockSubCollection = vi.fn().mockReturnValue({
    findNearest: mockFindNearest,
    doc: mockDoc,
  });

  const mockCollection = vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue({
      collection: mockSubCollection,
    }),
  });

  const mockFirestore = () => ({ collection: mockCollection });

  const mockEmbedContent = vi.fn();
  const mockGetVertexAIClient = vi.fn().mockReturnValue({
    models: { embedContent: mockEmbedContent },
  });

  return {
    mockSet,
    mockGet,
    mockFindNearest,
    mockDoc,
    mockSubCollection,
    mockCollection,
    mockFirestore,
    mockEmbedContent,
    mockGetVertexAIClient,
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
}));

vi.mock('../../lib/vertexClient', () => ({
  getVertexAIClient: mocks.mockGetVertexAIClient,
}));

import { queryKnowledgeBase } from './query';

describe('Knowledge Base Query Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates embedding and executes vector search returning citations and receipt', async () => {
    const dummyEmbedding = new Array(768).fill(0.01);
    mocks.mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: dummyEmbedding }],
    });

    mocks.mockGet.mockResolvedValue({
      docs: [
        {
          data: () => ({
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            text: 'Music distribution overview',
            ordinal: 0,
            pageNumber: 1,
          }),
        },
      ],
    });

    const handler = queryKnowledgeBase as any;
    const res = await handler({
      auth: { uid: 'user-1' },
      data: { query: 'how to distribute music', topK: 3 },
    });

    expect(res.query).toBe('how to distribute music');
    expect(res.citations).toHaveLength(1);
    expect(res.citations[0].chunkId).toBe('chunk-1');
    expect(mocks.mockFindNearest).toHaveBeenCalledWith('embedding', dummyEmbedding, {
      limit: 3,
      distanceMeasure: 'COSINE',
    });
    expect(mocks.mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'user-1',
        query: 'how to distribute music',
        topK: 3,
        resultsCount: 1,
        citationChunkIds: ['chunk-1'],
      })
    );
  });

  it('rejects unauthenticated queries', async () => {
    const handler = queryKnowledgeBase as any;
    await expect(handler({ auth: null, data: { query: 'test' } })).rejects.toThrow(
      'User must be authenticated'
    );
  });
});
