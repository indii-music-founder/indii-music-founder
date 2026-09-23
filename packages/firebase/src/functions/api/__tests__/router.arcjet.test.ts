import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  onRequest: vi.fn(),
  verifyIdToken: vi.fn(),
  protect: vi.fn(),
  policyForEntitlement: vi.fn(),
  requireEntitlement: vi.fn(),
  status: vi.fn(),
  json: vi.fn(),
  set: vi.fn(),
  firestoreCollection: vi.fn(),
  firestoreDoc: vi.fn(),
  nestedCollection: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  get: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
  onRequest: mocks.onRequest,
}));

vi.mock('firebase-admin', () => ({
  auth: () => ({ verifyIdToken: mocks.verifyIdToken }),
  firestore: () => ({ collection: mocks.firestoreCollection }),
}));

vi.mock('../../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protect,
  protectAnonymousSignupRequest: vi.fn(),
  policyClassForServerEntitlement: mocks.policyForEntitlement,
}));

vi.mock('../../auth/entitlements', () => ({
  requireVerifiedServerEntitlement: mocks.requireEntitlement,
}));

vi.mock('../../../config/secrets', () => ({ arcjetKey: { name: 'ARCJET_KEY' } }));

import { HttpsError } from 'firebase-functions/v2/https';

type RouterModule = typeof import('../router');
// ISSUE-1442: the track-CRUD, distribution-REST, and queryAnalytics routes were
// removed (zero client callers — the live pipeline writes Firestore directly).
type EndpointName = 'getProfile' | 'health';

let router: RouterModule;

function response() {
  mocks.status.mockReturnValue({ json: mocks.json, send: vi.fn() });
  return { status: mocks.status, json: mocks.json, set: mocks.set };
}

function request(method: string, path: string) {
  return {
    method,
    path,
    headers: { authorization: 'Bearer token' },
    body: {},
    query: {},
  };
}

describe('router Arcjet boundary', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.onRequest.mockImplementation((optionsOrHandler: unknown, handler?: unknown) => handler ?? optionsOrHandler);
    mocks.verifyIdToken.mockResolvedValue({ uid: 'owner-1', admin: false });
    mocks.requireEntitlement.mockResolvedValue({ tier: 'free' });
    mocks.policyForEntitlement.mockReturnValue('verified-free');
    mocks.protect.mockResolvedValue({
      allowed: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
      retryAfterSeconds: 22,
    });
    router = await import('../router');
  });

  it('binds the managed Arcjet secret to every REST endpoint that invokes request protection', () => {
    const endpointNames: EndpointName[] = ['getProfile', 'health'];

    expect(endpointNames).toHaveLength(2);
    expect(mocks.onRequest).toHaveBeenCalledTimes(2);
    for (const [options] of mocks.onRequest.mock.calls) {
      expect(options).toEqual({ secrets: [{ name: 'ARCJET_KEY' }] });
    }
  });

  it('fails closed before getProfile can read data when Arcjet denies the request', async () => {
    const res = response();
    const handler = router.getProfile as unknown as (
      req: ReturnType<typeof request>,
      res: ReturnType<typeof response>,
    ) => Promise<void>;
    await handler(request('GET', '/api/profile'), res);

    expect(mocks.protect).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/api/profile' }),
      expect.objectContaining({ userId: 'owner-1', policy: 'verified-free', operationId: expect.any(String) }),
    );
    expect(mocks.set).toHaveBeenCalledWith('Retry-After', '22');
    expect(mocks.status).toHaveBeenCalledWith(429);
    expect(mocks.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: 'RATE_LIMITED', retryAfterSeconds: 22 }),
    }));
  });

  it('preserves a verified-email or entitlement denial instead of masking it as invalid authentication', async () => {
    mocks.requireEntitlement.mockRejectedValue(new HttpsError('failed-precondition', 'Verify your email before activating an indii entitlement.'));
    const res = response();
    const handler = router.getProfile as unknown as (
      req: ReturnType<typeof request>,
      res: ReturnType<typeof response>,
    ) => Promise<void>;

    await handler(request('GET', '/api/profile'), res);

    expect(mocks.protect).not.toHaveBeenCalled();
    expect(mocks.status).toHaveBeenCalledWith(412);
    expect(mocks.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'FAILED_PRECONDITION' }),
    }));
  });
});

describe('router pagination normalization', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.onRequest.mockImplementation((optionsOrHandler: unknown, handler?: unknown) => handler ?? optionsOrHandler);
    mocks.verifyIdToken.mockResolvedValue({ uid: 'owner-1', admin: false });
    mocks.requireEntitlement.mockResolvedValue({ tier: 'free' });
    mocks.policyForEntitlement.mockReturnValue('verified-free');
    mocks.protect.mockResolvedValue({ allowed: true });
    router = await import('../router');
  });

  it('clamps oversized limits while preserving valid offsets', () => {
    expect(router.normalizePagination({ limit: '5000', offset: '25' }, { defaultLimit: 50, maxLimit: 1000 })).toEqual({
      limit: 1000,
      offset: 25,
    });
  });

  it('falls back for negative, blank, and non-finite pagination values', () => {
    expect(router.normalizePagination({ limit: '-5', offset: '-1' }, { defaultLimit: 50, maxLimit: 1000 })).toEqual({
      limit: 50,
      offset: 0,
    });
    expect(router.normalizePagination({ limit: '', offset: 'Infinity' }, { defaultLimit: 100, maxLimit: 1000 })).toEqual({
      limit: 100,
      offset: 0,
    });
  });
});
