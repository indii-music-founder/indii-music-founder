import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  httpsCallable: vi.fn(),
  isAnonymousOrDemoUser: vi.fn(),
  isDemoUserId: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'auth-user-1',
      isAnonymous: false,
      providerData: [{ providerId: 'google.com' }],
    },
  },
  db: {},
  functions: { region: 'us-central1' },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mocks.httpsCallable,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('@/utils/e2eMode', () => ({
  isFirebaseE2EMockEnabled: () => false,
}));

vi.mock('@/utils/authGuards', () => ({
  isAnonymousOrDemoUser: mocks.isAnonymousOrDemoUser,
  isDemoUserId: mocks.isDemoUserId,
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.unmock('@/services/billing/CostControlService');

import { CostControlService } from './CostControlService';

describe('CostControlService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('FIREBASE_E2E_MOCK', 'false');
    (window as Window & { FIREBASE_E2E_MOCK?: unknown }).FIREBASE_E2E_MOCK = false;
    mocks.isAnonymousOrDemoUser.mockReturnValue(false);
    mocks.isDemoUserId.mockReturnValue(false);
    mocks.httpsCallable.mockReturnValue(mocks.callable);
    mocks.callable.mockResolvedValue({
      data: {
        allowed: true,
        remainingBudget: 4.99,
        dailyUsed: 0.01,
        monthlyUsed: 0.01,
        operationId: 'op-server-1',
      },
    });
  });

  it('reserves cost through the us-central1 server callable', async () => {
    const result = await CostControlService.checkAndReserve({
      operationType: 'agent_stream',
      estimatedCost: 0.001,
      userId: 'stale-client-user',
      metadata: { commandId: 'cmd-1' },
    });

    expect(mocks.httpsCallable).toHaveBeenCalledWith(
      { region: 'us-central1' },
      'enforceOperationCost',
    );
    expect(mocks.callable).toHaveBeenCalledWith(expect.objectContaining({
      operationType: 'agent_stream',
      estimatedCost: 0.001,
      userId: 'auth-user-1',
      metadata: expect.objectContaining({ commandId: 'cmd-1' }),
    }));
    expect(result).toEqual({
      allowed: true,
      requiresConfirmation: undefined,
      reason: undefined,
      remainingBudget: 4.99,
      dailyUsed: 0.01,
      monthlyUsed: 0.01,
      operationId: 'op-server-1',
    });
  });

  it('preserves server confirmation responses', async () => {
    mocks.callable.mockResolvedValue({
      data: {
        allowed: false,
        requiresConfirmation: true,
        reason: 'This operation will cost $25.00.',
        remainingBudget: 25,
        dailyUsed: 0,
        monthlyUsed: 0,
      },
    });

    const result = await CostControlService.checkAndReserve({
      operationType: 'image',
      estimatedCost: 25,
      userId: 'auth-user-1',
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.reason).toBe('This operation will cost $25.00.');
  });

  it('blocks guest sessions before calling the server', async () => {
    mocks.isAnonymousOrDemoUser.mockReturnValue(true);

    const result = await CostControlService.checkAndReserve({
      operationType: 'agent_stream',
      estimatedCost: 0.001,
      userId: 'guest-user',
    });

    expect(mocks.httpsCallable).not.toHaveBeenCalled();
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Authenticated user is required for cost-controlled operations.');
  });

  it('fails closed when the server reservation is unavailable', async () => {
    mocks.callable.mockRejectedValue(new Error('network unavailable'));

    const result = await CostControlService.checkAndReserve({
      operationType: 'agent_stream',
      estimatedCost: 0.001,
      userId: 'auth-user-1',
    });

    expect(result.allowed).toBe(false);
    expect(result.remainingBudget).toBe(0);
  });
});
