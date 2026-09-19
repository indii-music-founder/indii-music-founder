import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn();
  const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
  const mockFindNearest = vi.fn().mockReturnValue({ get: mockGet });
  const mockWhere = vi.fn().mockReturnValue({ get: mockGetDocs, findNearest: mockFindNearest });
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
    const dummyEmbedding = new Array(768).fill(0);
    dummyEmbedding[0] = 1;
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
            startOffset: 0,
            endOffset: 27,
            embedding: dummyEmbedding
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
    expect(res.citations[0].relevanceScore).toBeCloseTo(1);
    expect(mocks.mockFindNearest).toHaveBeenCalledWith(
      'embedding',
      dummyEmbedding, // mock ignores FieldValue.vector wrapper differences
      {
        limit: 3,
        distanceMeasure: 'COSINE',
      }
    );
    expect(mocks.mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'user-1',
        queryText: 'how to distribute music',
        resultCount: 1,
        citations: expect.any(Array),
      })
    );
  });

  it('enforces minRelevance using cosine similarity from stored embeddings', async () => {
    const queryEmbedding = new Array(768).fill(0);
    queryEmbedding[0] = 1;
    const highEmbedding = [...queryEmbedding];
    const lowEmbedding = new Array(768).fill(0);
    lowEmbedding[0] = 0.6;
    lowEmbedding[1] = 0.8;

    mocks.mockEmbedContent.mockResolvedValue({ embeddings: [{ values: queryEmbedding }] });
    mocks.mockGet.mockResolvedValue({
      docs: [
        {
          data: () => ({
            documentId: 'doc-high',
            text: 'Directly relevant evidence',
            ordinal: 0,
            startOffset: 0,
            endOffset: 26,
            embedding: highEmbedding,
          }),
        },
        {
          data: () => ({
            documentId: 'doc-low',
            text: 'Only loosely related evidence',
            ordinal: 1,
            startOffset: 27,
            endOffset: 56,
            embedding: lowEmbedding,
          }),
        },
      ],
    });

    const fakeDocs = [
      { id: 'doc-high', data: () => ({ title: 'High relevance', state: 'active' }) },
      { id: 'doc-low', data: () => ({ title: 'Low relevance', state: 'active' }) },
    ];
    mocks.mockGetDocs.mockResolvedValue({
      docs: fakeDocs,
      forEach: (cb: any) => fakeDocs.forEach(cb),
    });

    const handler = queryKnowledgeBase as any;
    const res = await handler({
      auth: { uid: 'user-1' },
      data: { query: 'find direct evidence', topK: 5, minRelevance: 0.8 },
    });

    expect(res.citations).toHaveLength(1);
    expect(res.citations[0].documentId).toBe('doc-high');
    expect(res.citations[0].relevanceScore).toBeCloseTo(1);
  });

  it('rejects unauthenticated queries', async () => {
    const handler = queryKnowledgeBase as any;
    await expect(handler({ auth: null, data: { query: 'test' } })).rejects.toThrow(
      'User must be authenticated'
    );
  });

  it('limits a focused-document query to the selected document', async () => {
    mocks.mockEmbedContent.mockResolvedValue({ embeddings: [{ values: new Array(768).fill(0.01) }] });
    mocks.mockGet.mockResolvedValue({ docs: [] });

    const handler = queryKnowledgeBase as any;
    await handler({
      auth: { uid: 'user-1' },
      data: { query: 'summarize this', documentIdFilters: ['doc-1'] },
    });

    expect(mocks.mockWhere).toHaveBeenCalledWith('documentId', 'in', ['doc-1']);
    expect(mocks.mockFindNearest).toHaveBeenCalled();
  });
});
