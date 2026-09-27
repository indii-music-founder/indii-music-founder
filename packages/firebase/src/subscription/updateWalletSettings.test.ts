import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockDocGet = vi.fn();
  const mockDocUpdate = vi.fn();
  const mockDocSet = vi.fn();

  const mockTransaction = {
    get: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  };

  const mockRunTransaction = vi.fn(async (cb: (tx: typeof mockTransaction) => Promise<unknown>) => {
    return cb(mockTransaction);
  });

  const mockDoc: any = vi.fn((path?: string) => ({
    get: mockDocGet,
    update: mockDocUpdate,
    set: mockDocSet,
    path,
    id: path ? path.split('/').pop() : 'mock-id',
    collection: vi.fn((subCol?: string) => mockCollection(`${path}/${subCol}`)),
  }));

  const mockCollection: any = vi.fn((name?: string) => ({
    doc: vi.fn((subPath?: string) => mockDoc(`${name}/${subPath}`)),
  }));

  const mockDb = {
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  };

  return {
    mockDocGet,
    mockDocUpdate,
    mockDocSet,
    mockTransaction,
    mockRunTransaction,
    mockDoc,
    mockCollection,
    mockDb,
  };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mocks.mockDb,
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: unknown) => handler,
  HttpsError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { updateWalletSettings } from './updateWalletSettings';

function makeRequest(
  data: Record<string, unknown>,
  auth?: { uid: string; token?: Record<string, unknown> }
) {
  return {
    data,
    auth: auth ? { uid: auth.uid, token: auth.token || {} } : undefined,
  } as any;
}

describe('updateWalletSettings', () => {
  const fn = updateWalletSettings as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    await expect(
      fn(makeRequest({ autoTopUp: true }, undefined))
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects cross-user updates without admin claim', async () => {
    await expect(
      fn(makeRequest({ userId: 'other-user', autoTopUp: true }, { uid: 'user-1' }))
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects invalid autoTopUp argument', async () => {
    await expect(
      fn(makeRequest({ autoTopUp: 'invalid' }, { uid: 'user-1' }))
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects negative or non-integer autoTopUpThreshold', async () => {
    await expect(
      fn(makeRequest({ autoTopUp: true, autoTopUpThreshold: -10 }, { uid: 'user-1' }))
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    await expect(
      fn(makeRequest({ autoTopUp: true, autoTopUpThreshold: 12.5 }, { uid: 'user-1' }))
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects unknown autoTopUpPackId', async () => {
    await expect(
      fn(makeRequest({ autoTopUp: true, autoTopUpPackId: 'pack_fake_9999' }, { uid: 'user-1' }))
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('creates wallet with defaults when document does not exist', async () => {
    mocks.mockTransaction.get.mockResolvedValueOnce({
      exists: false,
      data: () => null,
    });

    const res = await fn(
      makeRequest(
        {
          autoTopUp: true,
          autoTopUpThreshold: 200,
          autoTopUpPackId: 'pack_growth_2500',
        },
        { uid: 'user-1' }
      )
    );

    expect(res.success).toBe(true);
    expect(res.wallet.userId).toBe('user-1');
    expect(res.wallet.balanceCredits).toBe(0);
    expect(res.wallet.autoTopUp).toBe(true);
    expect(res.wallet.autoTopUpThreshold).toBe(200);
    expect(res.wallet.autoTopUpPackId).toBe('pack_growth_2500');

    expect(mocks.mockTransaction.set).toHaveBeenCalledTimes(1);
    expect(mocks.mockTransaction.update).not.toHaveBeenCalled();
  });

  it('updates existing wallet document preserving balance and createdAt', async () => {
    const existingCreatedAt = 1600000000000;
    mocks.mockTransaction.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        userId: 'user-1',
        balanceCredits: 450,
        autoTopUp: false,
        autoTopUpThreshold: 100,
        currency: 'USD',
        createdAt: existingCreatedAt,
        updatedAt: existingCreatedAt,
      }),
    });

    const res = await fn(
      makeRequest(
        {
          autoTopUp: true,
          autoTopUpThreshold: 50,
          autoTopUpPackId: 'pack_starter_500',
        },
        { uid: 'user-1' }
      )
    );

    expect(res.success).toBe(true);
    expect(res.wallet.balanceCredits).toBe(450);
    expect(res.wallet.autoTopUp).toBe(true);
    expect(res.wallet.autoTopUpThreshold).toBe(50);
    expect(res.wallet.autoTopUpPackId).toBe('pack_starter_500');
    expect(res.wallet.createdAt).toBe(existingCreatedAt);

    expect(mocks.mockTransaction.update).toHaveBeenCalledTimes(1);
    expect(mocks.mockTransaction.set).not.toHaveBeenCalled();
  });

  it('allows admin to update another user wallet settings', async () => {
    mocks.mockTransaction.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        userId: 'target-user',
        balanceCredits: 1000,
        createdAt: 1600000000000,
      }),
    });

    const res = await fn(
      makeRequest(
        {
          userId: 'target-user',
          autoTopUp: false,
        },
        { uid: 'admin-user', token: { admin: true } }
      )
    );

    expect(res.success).toBe(true);
    expect(res.wallet.userId).toBe('target-user');
    expect(res.wallet.autoTopUp).toBe(false);
  });
});
