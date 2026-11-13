import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  httpsCallable: vi.fn(),
  isAnonymousOrDemoUser: vi.fn(),
  isDemoUserId: vi.fn(),
  getIdTokenResult: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'auth-user-1',
      isAnonymous: false,
      providerData: [{ providerId: 'google.com' }],
      getIdTokenResult: mocks.getIdTokenResult,
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

vi.mock('@/utils/e2eMode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/e2eMode')>();
  return {
    ...actual,
    isFirebaseE2EMockEnabled: () => false,
    isTestHarnessRuntime: () => false,
  };
});

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
    vi.stubEnv('VITE_API_KEY', '');
    vi.stubEnv('VITE_E2E_MOCK', '');
    vi.stubEnv('VITE_PLAYWRIGHT_E2E', '');
    mocks.isAnonymousOrDemoUser.mockReturnValue(false);
    mocks.isDemoUserId.mockReturnValue(false);
    mocks.getIdTokenResult.mockResolvedValue({ claims: {} });
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
      metadata: expect.objectContaining({ commandId: 'cmd-1' }),
    }));
    expect(mocks.callable.mock.calls[0]?.[0]).not.toHaveProperty('userId');
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

  it.each(['image', 'video'] as const)('keeps %s reservations on the existing enforceOperationCost contract', async (operationType) => {
    await CostControlService.checkAndReserve({
      operationType,
      estimatedCost: operationType === 'image' ? 0.04 : 0.5,
      userId: 'auth-user-1',
      metadata: { source: 'regression' },
    });

    expect(mocks.httpsCallable).toHaveBeenCalledWith(
      { region: 'us-central1' },
      'enforceOperationCost',
    );
    expect(mocks.callable).toHaveBeenCalledWith(expect.objectContaining({
      operationType,
      metadata: expect.objectContaining({ source: 'regression' }),
    }));
  });

  it('uses the authenticated billing transport for a typed Boardroom dispatch plan', async () => {
    const plan = {
      type: 'BOARDROOM_DISPATCH_PLAN' as const,
      code: 'BOARDROOM_DISPATCH_READY' as const,
      executedAgentIds: ['generalist', 'marketing'],
      deferredAgentIds: ['legal'],
      maxIterationsPerAgent: 2,
      nextContinuationAgentId: 'legal',
      leaseId: '11111111-1111-4111-8111-111111111111',
      leaseExpiresAtMs: Date.now() + 60_000,
      sideEffectOwnerAgentId: 'generalist',
    };
    mocks.callable.mockResolvedValueOnce({ data: plan });

    await expect(CostControlService.getBoardroomDispatchPlan([
      'generalist', 'marketing', 'legal',
    ])).resolves.toEqual(plan);
    expect(mocks.httpsCallable).toHaveBeenCalledWith(
      { region: 'us-central1' },
      'planBoardroomAgentStreamDispatch',
    );
    expect(mocks.callable).toHaveBeenCalledWith({ agentIds: ['generalist', 'marketing', 'legal'] });
  });

  it('rejects a malformed Boardroom plan instead of allowing client fan-out', async () => {
    mocks.callable.mockResolvedValueOnce({
      data: {
        type: 'BOARDROOM_DISPATCH_PLAN',
        code: 'BOARDROOM_DISPATCH_READY',
        executedAgentIds: ['generalist'],
        deferredAgentIds: [],
        maxIterationsPerAgent: 8,
        nextContinuationAgentId: null,
        leaseId: '11111111-1111-4111-8111-111111111111',
        leaseExpiresAtMs: Date.now() + 60_000,
        sideEffectOwnerAgentId: 'generalist',
      },
    });

    await expect(CostControlService.getBoardroomDispatchPlan(['generalist', 'marketing']))
      .rejects.toThrow('invalid plan');
  });

  it('accepts a typed active-turn deferral and transports explicit lease completion', async () => {
    mocks.callable.mockResolvedValueOnce({
      data: {
        type: 'BOARDROOM_DISPATCH_PLAN',
        code: 'BOARDROOM_DISPATCH_ACTIVE_TURN',
        executedAgentIds: [],
        deferredAgentIds: ['generalist', 'marketing'],
        maxIterationsPerAgent: 2,
        nextContinuationAgentId: 'generalist',
        leaseId: null,
        leaseExpiresAtMs: Date.now() + 60_000,
        sideEffectOwnerAgentId: null,
      },
    });
    await expect(CostControlService.getBoardroomDispatchPlan(['generalist', 'marketing']))
      .resolves.toMatchObject({ code: 'BOARDROOM_DISPATCH_ACTIVE_TURN', leaseId: null });

    mocks.callable.mockResolvedValueOnce({ data: { completed: true } });
    await CostControlService.completeBoardroomDispatchLease('11111111-1111-4111-8111-111111111111');
    expect(mocks.httpsCallable).toHaveBeenLastCalledWith(
      { region: 'us-central1' },
      'completeBoardroomAgentStreamDispatch',
    );
    expect(mocks.callable).toHaveBeenLastCalledWith({ leaseId: '11111111-1111-4111-8111-111111111111' });
  });

  it('rejects a READY plan whose advertised lease is not an opaque UUID', async () => {
    mocks.callable.mockResolvedValueOnce({
      data: {
        type: 'BOARDROOM_DISPATCH_PLAN',
        code: 'BOARDROOM_DISPATCH_READY',
        executedAgentIds: ['generalist'],
        deferredAgentIds: [],
        maxIterationsPerAgent: 2,
        nextContinuationAgentId: null,
        leaseId: '------------------------------------',
        leaseExpiresAtMs: Date.now() + 60_000,
        sideEffectOwnerAgentId: 'generalist',
      },
    });

    await expect(CostControlService.getBoardroomDispatchPlan(['generalist']))
      .rejects.toThrow('invalid plan');
  });

  it('requires a durable server reservation for founder and admin accounts', async () => {
    mocks.getIdTokenResult.mockResolvedValue({
      claims: { god_mode: true, founder: true, admin: true, tier: 'founder' },
    });

    const result = await CostControlService.checkAndReserve({
      operationType: 'image',
      estimatedCost: 0.04,
      userId: 'auth-user-1',
      metadata: { imageCount: 1 },
    });

    expect(mocks.httpsCallable).toHaveBeenCalledWith(
      { region: 'us-central1' },
      'enforceOperationCost',
    );
    expect(mocks.callable).toHaveBeenCalledOnce();
    expect(mocks.getIdTokenResult).not.toHaveBeenCalled();
    expect(result.operationId).toBe('op-server-1');
    expect(result.operationId).not.toMatch(/^god(?:-catch)?-/);
  });

  it('fails closed for founder accounts when the server cannot reserve cost', async () => {
    mocks.getIdTokenResult.mockResolvedValue({
      claims: { god_mode: true, founder: true, admin: true, tier: 'founder' },
    });
    mocks.callable.mockRejectedValue(new Error('network unavailable'));

    const result = await CostControlService.checkAndReserve({
      operationType: 'image',
      estimatedCost: 0.04,
      userId: 'auth-user-1',
    });

    expect(result.allowed).toBe(false);
    expect(result.operationId).toBeUndefined();
    expect(mocks.callable).toHaveBeenCalledOnce();
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

  it('gets owner-scoped status and explicit pending holds from the server receipt', async () => {
    mocks.callable.mockResolvedValueOnce({
      data: {
        dailyUsed: 4,
        monthlyUsed: 17,
        dailyRemaining: 21,
        monthlyRemaining: 233,
        tier: 'pro',
        pendingHoldCost: 1.5,
        pendingHoldCount: 2,
        settledCost: 12.5,
        voidedCost: 3,
      },
    });

    await expect(CostControlService.getStatus('auth-user-1')).resolves.toEqual({
      dailyUsed: 4,
      monthlyUsed: 17,
      dailyRemaining: 21,
      monthlyRemaining: 233,
      tier: 'pro',
      pendingHoldCost: 1.5,
      pendingHoldCount: 2,
      settledCost: 12.5,
      voidedCost: 3,
    });
    expect(mocks.httpsCallable).toHaveBeenCalledWith({ region: 'us-central1' }, 'getOperationCostStatus');
    expect(mocks.callable).toHaveBeenCalledWith();
  });

  it('normalizes an incomplete status receipt instead of exposing undefined UI values', async () => {
    mocks.callable.mockResolvedValueOnce({ data: {} });

    await expect(CostControlService.getStatus('auth-user-1')).resolves.toEqual({
      dailyUsed: 0,
      monthlyUsed: 0,
      dailyRemaining: 0,
      monthlyRemaining: 0,
      tier: 'free',
      pendingHoldCost: 0,
      pendingHoldCount: 0,
      settledCost: 0,
      voidedCost: 0,
    });
  });

  it('gets an owner-scoped cursor-paginated operation history', async () => {
    const nextCursor = { timestampMs: 1_784_240_000_000, operationId: 'op-older' };
    mocks.callable.mockResolvedValueOnce({
      data: {
        operations: [{
          operationId: 'op-pending',
          operationType: 'image',
          status: 'APPROVED',
          estimatedCost: 0.12,
          createdAt: '2026-07-16T20:00:00.000Z',
          finalizedAt: null,
          autoReleaseAt: '2026-07-16T20:15:00.000Z',
          resolution: 'pending_auto_release',
        }],
        nextCursor,
        hasMore: true,
      },
    });

    await expect(CostControlService.getHistory('auth-user-1', null, 5)).resolves.toEqual({
      operations: [expect.objectContaining({
        operationId: 'op-pending',
        resolution: 'pending_auto_release',
      })],
      nextCursor,
      hasMore: true,
    });
    expect(mocks.httpsCallable).toHaveBeenCalledWith(
      { region: 'us-central1' },
      'getOperationCostHistory',
    );
    expect(mocks.callable).toHaveBeenCalledWith({ cursor: null, limit: 5 });
  });

  it('normalizes an incomplete operation-history receipt', async () => {
    mocks.callable.mockResolvedValueOnce({ data: {} });

    await expect(CostControlService.getHistory('auth-user-1')).resolves.toEqual({
      operations: [],
      nextCursor: null,
      hasMore: false,
    });
  });
});
