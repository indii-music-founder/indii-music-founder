import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn();
  const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
  const mockWhere = vi.fn().mockReturnValue({ get: mockGetDocs });
  const mockFindNearest = vi.fn().mockReturnValue({ get: mockGet });
  const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
  const mockSubCollection = vi.fn().mockReturnValue({
    findNearest: mockFindNearest,
    doc: mockDoc,
    where: mockWhere,
  });

  const mockCollection = vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue({
      collection: mockSubCollection,
    }),
  });

  const mockFirestore = () => ({ collection: mockCollection });
  (mockFirestore as any).FieldPath = { documentId: vi.fn().mockReturnValue('__name__') };

  const mockEmbedContent = vi.fn();
  const mockGenerateContent = vi.fn().mockResolvedValue({ text: 'This is a mocked answer.' });
  const mockGetVertexAIClient = vi.fn().mockReturnValue({
    models: { embedContent: mockEmbedContent, generateContent: mockGenerateContent },
  });

  return {
    mockSet,
    mockGet,
    mockFindNearest,
    mockDoc,
    mockSubCollection,
    mockCollection,
    mockFirestore,
    mockWhere,
    mockGetDocs,
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
            distance: 0.1, // Relevance will be 1 - 0.1 = 0.9
          }),
        },
      ],
    });

    const fakeDocs = [
      {
        id: 'doc-1',
        data: () => ({
          title: 'Music distribution overview doc',
          state: 'active',
        }),
      },
    ];

    mocks.mockGetDocs.mockResolvedValue({
      docs: fakeDocs,
      forEach: (cb: any) => fakeDocs.forEach(cb),
    });

    const handler = queryKnowledgeBase as any;
    const res = await handler({
      auth: { uid: 'user-1' },
      data: { query: 'how to distribute music', topK: 3 },
    });

    expect(res.query).toBe('how to distribute music');
    expect(res.citations).toHaveLength(1);
    expect(res.citations[0].documentId).toBe('doc-1');
    expect(mocks.mockFindNearest).toHaveBeenCalledWith({
      vectorField: 'embedding',
      queryVector: dummyEmbedding, // mock ignores FieldValue.vector wrapper
      limit: 6,
      distanceMeasure: 'COSINE',
      distanceResultField: 'distance',
    });
    expect(mocks.mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'user-1',
        queryText: 'how to distribute music',
        resultCount: 1,
        citations: expect.any(Array),
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
