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
  firestore: () => ({ collection: vi.fn() }),
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
type EndpointName =
  | 'getTrack'
  | 'createTrack'
  | 'queryAnalytics'
  | 'updateTrack'
  | 'deleteTrack'
  | 'listTracks'
  | 'createDistribution'
  | 'getDistribution'
  | 'submitDistribution'
  | 'getProfile'
  | 'health';

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
    const endpointNames: EndpointName[] = [
      'getTrack', 'createTrack', 'queryAnalytics', 'updateTrack', 'deleteTrack', 'listTracks',
      'createDistribution', 'getDistribution', 'submitDistribution', 'getProfile', 'health',
    ];

    expect(endpointNames).toHaveLength(11);
    expect(mocks.onRequest).toHaveBeenCalledTimes(11);
    for (const [options] of mocks.onRequest.mock.calls) {
      expect(options).toEqual({ secrets: [{ name: 'ARCJET_KEY' }] });
    }
  });

  it.each([
    ['createTrack', 'POST', '/api/tracks'],
    ['updateTrack', 'PUT', '/api/tracks/track-1'],
    ['deleteTrack', 'DELETE', '/api/tracks/track-1'],
    ['createDistribution', 'POST', '/api/distributions'],
    ['submitDistribution', 'POST', '/api/distributions/dist-1/submit'],
  ] as const)('fails closed before %s can mutate data', async (name, method, path) => {
    const res = response();
    const handler = router[name as Extract<EndpointName, 'createTrack' | 'updateTrack' | 'deleteTrack' | 'createDistribution' | 'submitDistribution'>] as unknown as (
      req: ReturnType<typeof request>,
      res: ReturnType<typeof response>,
    ) => Promise<void>;
    await handler(request(method, path), res);

    expect(mocks.protect).toHaveBeenCalledWith(
      expect.objectContaining({ method, path }),
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
    const handler = router.createTrack as unknown as (
      req: ReturnType<typeof request>,
      res: ReturnType<typeof response>,
    ) => Promise<void>;

    await handler(request('POST', '/api/tracks'), res);

    expect(mocks.protect).not.toHaveBeenCalled();
    expect(mocks.status).toHaveBeenCalledWith(412);
    expect(mocks.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'FAILED_PRECONDITION' }),
    }));
  });
});
