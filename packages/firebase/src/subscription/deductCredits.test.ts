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

import { deductCredits } from './deductCredits';

function makeRequest(
  data: Record<string, unknown>,
  auth?: { uid: string; token?: Record<string, unknown> }
) {
  return {
    data,
    auth: auth ? { uid: auth.uid, token: auth.token || {} } : undefined,
  } as any;
}

describe('deductCredits', () => {
  const fn = deductCredits as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    await expect(fn(makeRequest({ amount: 50, reason: 'AI Gen' }, undefined))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects cross-user caller mismatch for non-admin callers', async () => {
    await expect(
      fn(makeRequest({ amount: 50, reason: 'AI Gen', userId: 'victim-uid' }, { uid: 'attacker-uid' }))
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects non-positive and non-integer credit amounts', async () => {
    const auth = { uid: 'user-1' };
    await expect(fn(makeRequest({ amount: 0, reason: 'AI Gen' }, auth))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(fn(makeRequest({ amount: -10, reason: 'AI Gen' }, auth))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(fn(makeRequest({ amount: 12.5, reason: 'AI Gen' }, auth))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(fn(makeRequest({ amount: '50' as any, reason: 'AI Gen' }, auth))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects empty or non-string reason', async () => {
    const auth = { uid: 'user-1' };
    await expect(fn(makeRequest({ amount: 50, reason: '' }, auth))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(fn(makeRequest({ amount: 50 }, auth))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('fails with failed-precondition if balance is insufficient', async () => {
    const auth = { uid: 'user-1' };

    mocks.mockTransaction.get.mockImplementation(async (ref: any) => {
      if (ref.path?.includes('wallet/current')) {
        return {
          exists: true,
          data: () => ({ balanceCredits: 30 }),
        };
      }
      return { exists: false, data: () => null };
    });

    await expect(
      fn(makeRequest({ amount: 50, reason: 'Mastering task' }, auth))
    ).rejects.toMatchObject({
      code: 'failed-precondition',
    });

    expect(mocks.mockTransaction.update).not.toHaveBeenCalled();
    expect(mocks.mockTransaction.set).not.toHaveBeenCalled();
  });

  it('successfully deducts credits, writes transaction, and updates legacy balance', async () => {
    const auth = { uid: 'user-1' };

    mocks.mockTransaction.get.mockImplementation(async (ref: any) => {
      if (ref.path?.includes('wallet/current')) {
        return {
          exists: true,
          data: () => ({ balanceCredits: 200 }),
        };
      }
      if (ref.path?.includes('user_credits')) {
        return {
          exists: true,
          data: () => ({ balance: 200 }),
        };
      }
      return { exists: false, data: () => null };
    });

    const result = await fn(
      makeRequest(
        { amount: 50, reason: '4K Upscale Task', referenceId: 'ref-task-123' },
        auth
      )
    );

    expect(result.success).toBe(true);
    expect(result.balanceAfter).toBe(150);
    expect(result.transactionId).toMatch(/^tx_/);

    // Verify wallet/current update
    expect(mocks.mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/wallet/current' }),
      expect.objectContaining({
        balanceCredits: 150,
      })
    );

    // Verify credit_transactions log
    expect(mocks.mockTransaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('users/user-1/credit_transactions/tx_') }),
      expect.objectContaining({
        userId: 'user-1',
        type: 'CONSUMPTION',
        amountCredits: 50,
        balanceAfter: 150,
        reason: '4K Upscale Task',
        referenceId: 'ref-task-123',
      })
    );

    // Verify legacy user_credits update
    expect(mocks.mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'user_credits/user-1' }),
      expect.objectContaining({
        balance: 150,
      })
    );
  });

  it('triggers autoTopUp event when balance drops below threshold', async () => {
    const auth = { uid: 'user-1' };

    mocks.mockTransaction.get.mockImplementation(async (ref: any) => {
      if (ref.path === 'users/user-1/wallet/current') {
        return {
          exists: true,
          data: () => ({
            balanceCredits: 120,
            autoTopUp: true,
            autoTopUpThreshold: 100,
            autoTopUpPackId: 'pack_growth_2500',
          }),
        };
      }
      return { exists: false, data: () => null };
    });

    const result = await fn(
      makeRequest(
        { amount: 50, reason: 'Mastering Session' },
        auth
      )
    );

    expect(result.success).toBe(true);
    expect(result.balanceAfter).toBe(70);
    expect(result.autoTopUpTriggered).toBe(true);

    // Verify wallet_events document was set
    expect(mocks.mockTransaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('users/user-1/wallet_events/event_') }),
      expect.objectContaining({
        userId: 'user-1',
        type: 'AUTO_TOP_UP_TRIGGERED',
        balanceAfter: 70,
        threshold: 100,
        packId: 'pack_growth_2500',
        status: 'PENDING',
      })
    );
  });
});
