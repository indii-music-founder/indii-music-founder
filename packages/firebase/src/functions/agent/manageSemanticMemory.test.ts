import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEmbedContent = vi.hoisted(() => vi.fn());
const mockFindNearest = vi.hoisted(() => vi.fn());
const mockMemoriesDocSet = vi.hoisted(() => vi.fn());
const mockVector = vi.hoisted(() => vi.fn());
const mockOnCall = vi.hoisted(() => vi.fn((options, handler) => handler));
const mockFieldValue = vi.hoisted(() => ({
  vector: mockVector,
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
}));

const mockMemoriesDoc = vi.hoisted(() => ({
  id: 'memory-1',
  set: mockMemoriesDocSet,
}));

const mockMemoriesCollection = vi.hoisted(() => ({
  doc: vi.fn(() => mockMemoriesDoc),
  findNearest: mockFindNearest,
}));

const mockUsersDoc = vi.hoisted(() => ({
  collection: vi.fn(() => mockMemoriesCollection),
}));

const mockFirestore = vi.hoisted(() =>
  vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => mockUsersDoc),
    })),
  }))
);

vi.mock('firebase-functions/v2/https', () => ({
  onCall: mockOnCall,
  HttpsError: class HttpsError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('firebase-admin', () => ({
  firestore: mockFirestore,
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: mockFieldValue,
}));

vi.mock('../../lib/vertexClient', () => ({
  getVertexAIClient: vi.fn(() => ({
    models: {
      embedContent: mockEmbedContent,
    },
  })),
}));

import { manageSemanticMemory } from './manageSemanticMemory';

const callManageSemanticMemory = manageSemanticMemory as unknown as (request: {
  auth?: { uid: string };
  data: Record<string, unknown>;
}) => Promise<unknown>;

describe('manageSemanticMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFieldValue.vector = mockVector;
    mockMemoriesCollection.findNearest = mockFindNearest;
  });

  it('fails honestly when Firestore vector search is unavailable', async () => {
    mockMemoriesCollection.findNearest = undefined as unknown as typeof mockFindNearest;
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2, 0.3] }],
    });

    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'search',
        query: 'hello world',
        limit: 5,
      },
    })).rejects.toMatchObject({
      code: 'unavailable',
      message: 'Firestore vector search is not available in this deployment.',
    });
  });

  it('stores memories when vector writes are available even if nearest search is unavailable', async () => {
    mockMemoriesCollection.findNearest = undefined as unknown as typeof mockFindNearest;
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.4, 0.5, 0.6] }],
    });
    mockVector.mockImplementation((values: unknown) => ({ values }));

    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'add',
        memory: 'User prefers short answers',
      },
    })).resolves.toEqual({
      results: [
        {
          id: 'memory-1',
          memory: 'User prefers short answers',
          created_at: expect.any(String),
        },
      ],
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'text-embedding-004',
        contents: 'User prefers short answers',
      }),
    );
    expect(mockMemoriesDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'memory-1',
        memory: 'User prefers short answers',
        embedding: expect.objectContaining({ values: [0.4, 0.5, 0.6] }),
      }),
    );
  });

  it('fails honestly when Firestore vector writes are unavailable', async () => {
    mockFieldValue.vector = undefined as unknown as typeof mockVector;
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.7, 0.8, 0.9] }],
    });

    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'add',
        memory: 'User likes direct answers',
      },
    })).rejects.toMatchObject({
      code: 'unavailable',
      message: 'Firestore vector writes are not available in this deployment.',
    });

    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockMemoriesDocSet).not.toHaveBeenCalled();
  });

  it('rejects malformed embedding payloads before writing', async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: ['oops' as unknown as number, 0.2, 0.3] }],
    });
    mockVector.mockImplementation((values: unknown) => ({ values }));

    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'add',
        memory: 'User likes direct answers',
      },
    })).rejects.toMatchObject({
      code: 'internal',
      message: 'Embedding vector for memory contains an invalid value.',
    });

    expect(mockMemoriesDocSet).not.toHaveBeenCalled();
  });

  it('rejects malformed request data cleanly', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: null as unknown as Record<string, unknown>,
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Request data must be an object.',
    });
  });

  it('rejects array request data cleanly', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: [] as unknown as Record<string, unknown>,
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Request data must be an object.',
    });
  });

  it('rejects missing actions cleanly', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        query: 'user preferences',
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Missing action (add or search).',
    });
  });

  it('normalizes action casing and surrounding whitespace', async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.3, 0.3, 0.3] }],
    });
    mockFindNearest.mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: [] }),
    });

    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: '  SEARCH  ',
        query: 'trimmed query',
        limit: '7',
      },
    })).resolves.toEqual({ results: [], hasMore: false });

    expect(mockFindNearest).toHaveBeenCalledWith(
      'embedding',
      [
        0.3, // "cancel" semantic vector
        0.3, // "action"
        0.3, // "intention"
      ],
      expect.objectContaining({
        distanceMeasure: 'COSINE',
        limit: 8,
      })
    );expect(mockVector).not.toHaveBeenCalled();
  });

  it('rejects unsupported actions after normalization', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: '  delete  ',
        query: 'user preferences',
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Unknown action. Use "add" or "search".',
    });
  });

  it('rejects invalid search limits cleanly', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'search',
        query: 'user preferences',
        limit: 0,
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Search limit must be a positive integer.',
    });
  });

  it('rejects non-numeric search limits cleanly', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'search',
        query: 'user preferences',
        limit: true,
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Search limit must be a positive integer.',
    });
  });

  it('rejects non-integer search limits cleanly', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'search',
        query: 'user preferences',
        limit: 2.5,
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Search limit must be a positive integer.',
    });
  });

  it('rejects empty semantic text cleanly', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'search',
        query: '   ',
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'query cannot be empty.',
    });
  });

  it('rejects oversized semantic memory cleanly', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'add',
        memory: 'x'.repeat(4001),
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'memory exceeds the maximum length of 4000 characters.',
    });
  });

  it('rejects oversized semantic queries cleanly', async () => {
    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'search',
        query: 'x'.repeat(4001),
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'query exceeds the maximum length of 4000 characters.',
    });
  });

  it('returns semantic matches when vector search is available', async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2, 0.3] }],
    });
    mockFindNearest.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'memory-1',
            data: () => ({
              memory: 'User likes concise explanations',
              created_at: {
                toDate: () => new Date('2026-07-01T00:00:00.000Z'),
              },
            }),
          },
        ],
      }),
    });

    await expect(callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'search',
        query: 'user preferences',
        limit: 5,
      },
    })).resolves.toEqual({
      results: [
        {
          id: 'memory-1',
          memory: 'User likes concise explanations',
          created_at: '2026-07-01T00:00:00.000Z',
        },
      ],
      hasMore: false,
    });

    expect(mockFindNearest).toHaveBeenCalledWith(
      'embedding',
      [
        0.1, // "how"
        0.2, // "do"
        0.3, // "i"
      ],
      expect.objectContaining({
        distanceMeasure: 'COSINE',
        limit: 6,
      })
    );expect(mockVector).not.toHaveBeenCalled();
  });

  it('caps search limits to a safe maximum', async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.2, 0.4, 0.6] }],
    });
    mockFindNearest.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: [],
      }),
    });

    await callManageSemanticMemory({
      auth: { uid: 'user-123' },
      data: {
        action: 'search',
        query: 'user preferences',
        limit: 999,
      },
    });

    expect(mockFindNearest).toHaveBeenCalledWith(
      'embedding',
      [
        0.2,
        0.4,
        0.6,
      ],
      expect.objectContaining({
        distanceMeasure: 'COSINE',
        limit: 101, // Max limit = 100 + 1 pagination buffer
      })
    );
});
});
