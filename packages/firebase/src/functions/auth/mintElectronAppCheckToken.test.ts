import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createToken: vi.fn(),
  protect: vi.fn(),
}));

vi.mock('firebase-admin', () => ({ appCheck: () => ({ createToken: mocks.createToken }) }));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));
vi.mock('../../config/secrets', () => ({ arcjetKey: { name: 'ARCJET_KEY' } }));
vi.mock('../security/arcjet', () => ({ protectAuthenticatedApiRequest: mocks.protect }));

import { mintElectronAppCheckToken } from './mintElectronAppCheckToken';

const appId = '1:148015878263:web:febc76c0bd56f28cdbb672';
const request = (overrides: Record<string, unknown> = {}) => ({
  auth: { uid: 'artist-1', token: { email_verified: true, firebase: { sign_in_provider: 'password' } } },
  data: { appId },
  rawRequest: { method: 'POST', headers: {} },
  ...overrides,
}) as never;
const invoke = mintElectronAppCheckToken as unknown as (input: ReturnType<typeof request>) => Promise<unknown>;

describe('Electron App Check token mint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protect.mockResolvedValue({ allowed: true });
    mocks.createToken.mockResolvedValue({ token: 'issued-token', ttlMillis: 3_600_000 });
  });

  it('requires a verified non-anonymous account before admission', async () => {
    await expect(invoke(request({ auth: { uid: 'artist-1', token: { email_verified: false } } }))).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(invoke(request({ auth: { uid: 'artist-1', token: { email_verified: true, firebase: { sign_in_provider: 'anonymous' } } } }))).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mocks.protect).not.toHaveBeenCalled();
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it('rejects caller selected app IDs before issuing a token', async () => {
    await expect(invoke(request({ data: { appId: 'another-firebase-app' } }))).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it('fails closed when request admission is unavailable or denied', async () => {
    await expect(invoke(request({ rawRequest: undefined }))).rejects.toMatchObject({ code: 'unavailable' });
    mocks.protect.mockResolvedValue({ allowed: false, status: 429, message: 'Rate limit reached.' });
    await expect(invoke(request())).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it('passes the authenticated user to admission and mints only the allowed app', async () => {
    await expect(invoke(request())).resolves.toMatchObject({ token: 'issued-token' });
    expect(mocks.protect).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'artist-1', policy: 'verified-free' }));
    expect(mocks.createToken).toHaveBeenCalledWith(appId);
  });
});
