import { describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';

import {
  redeemStoredHandoff,
  verifyPkce,
  isRateLimited,
  type HandoffRedemptionDependencies,
} from './handoff';

const NOW = new Date('2026-08-24T00:16:00.000Z');

function dependencies(
  overrides: Partial<HandoffRedemptionDependencies> = {},
): HandoffRedemptionDependencies {
  return {
    load: vi.fn().mockResolvedValue({
      userId: 'founder-1',
      expiresAt: new Date(NOW.getTime() + 60_000),
    }),
    expire: vi.fn().mockResolvedValue(undefined),
    mintCustomToken: vi.fn().mockResolvedValue('phone-custom-token'),
    consume: vi.fn().mockResolvedValue(true),
    now: () => NOW,
    ...overrides,
  };
}

describe('redeemStoredHandoff', () => {
  it('mints custom token strictly AFTER the one-time record is atomically consumed', async () => {
    const deps = dependencies();

    await expect(redeemStoredHandoff(deps)).resolves.toEqual({
      status: 200,
      customToken: 'phone-custom-token',
    });
    expect(deps.consume).toHaveBeenCalledWith('founder-1', NOW);
    expect(deps.mintCustomToken).toHaveBeenCalledWith('founder-1');
  });

  it('never calls mintCustomToken when another request wins the consume race', async () => {
    const deps = dependencies({ consume: vi.fn().mockResolvedValue(false) });

    await expect(redeemStoredHandoff(deps)).resolves.toEqual({
      status: 404,
      message: 'Invalid or expired code',
    });
    expect(deps.consume).toHaveBeenCalled();
    expect(deps.mintCustomToken).not.toHaveBeenCalled();
  });

  it('expires stale records without minting a custom token', async () => {
    const deps = dependencies({
      load: vi.fn().mockResolvedValue({
        userId: 'founder-1',
        expiresAt: new Date(NOW.getTime() - 1),
      }),
    });

    await expect(redeemStoredHandoff(deps)).resolves.toEqual({
      status: 404,
      message: 'Invalid or expired code',
    });
    expect(deps.expire).toHaveBeenCalledOnce();
    expect(deps.mintCustomToken).not.toHaveBeenCalled();
    expect(deps.consume).not.toHaveBeenCalled();
  });

  it('validates PKCE challenge and rejects invalid verifier without consuming or minting', async () => {
    const rawVerifier = 'my-secret-pkce-verifier-string-12345';
    const challenge = crypto.createHash('sha256').update(rawVerifier).digest('hex');

    const deps = dependencies({
      load: vi.fn().mockResolvedValue({
        userId: 'founder-1',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
        expiresAt: new Date(NOW.getTime() + 60_000),
      }),
    });

    // 1. Missing verifier
    await expect(redeemStoredHandoff(deps)).resolves.toEqual({
      status: 400,
      message: 'Invalid code verifier',
    });
    expect(deps.consume).not.toHaveBeenCalled();
    expect(deps.mintCustomToken).not.toHaveBeenCalled();

    // 2. Incorrect verifier
    await expect(redeemStoredHandoff(deps, { codeVerifier: 'wrong-verifier' })).resolves.toEqual({
      status: 400,
      message: 'Invalid code verifier',
    });
    expect(deps.consume).not.toHaveBeenCalled();
    expect(deps.mintCustomToken).not.toHaveBeenCalled();

    // 3. Valid verifier
    await expect(redeemStoredHandoff(deps, { codeVerifier: rawVerifier })).resolves.toEqual({
      status: 200,
      customToken: 'phone-custom-token',
    });
    expect(deps.consume).toHaveBeenCalled();
    expect(deps.mintCustomToken).toHaveBeenCalledWith('founder-1');
  });
});

describe('verifyPkce', () => {
  it('correctly validates S256 hex and base64url digests', () => {
    const verifier = 'random-verifier-high-entropy-string-abc-123';
    const hexChallenge = crypto.createHash('sha256').update(verifier).digest('hex');
    const b64Challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    expect(verifyPkce(verifier, hexChallenge, 'S256')).toBe(true);
    expect(verifyPkce(verifier, b64Challenge, 'S256')).toBe(true);
    expect(verifyPkce(verifier, 'mismatched-challenge', 'S256')).toBe(false);
    expect(verifyPkce('', hexChallenge, 'S256')).toBe(false);
  });

  it('validates plain method if specified', () => {
    expect(verifyPkce('plain-secret', 'plain-secret', 'plain')).toBe(true);
    expect(verifyPkce('plain-secret', 'different-secret', 'plain')).toBe(false);
  });
});

describe('isRateLimited', () => {
  it('fails closed (returns true) when database transaction throws', async () => {
    const mockDb: any = {
      collection: () => ({
        doc: () => ({}),
      }),
      runTransaction: vi.fn().mockRejectedValue(new Error('Firestore contention timeout')),
    };

    const limited = await isRateLimited('192.168.1.50', 'create_handoff', mockDb);
    expect(limited).toBe(true); // Fails closed
  });

  it('allows request and records initial attempt in rate_limits collection', async () => {
    let storedData: any = null;
    const mockDb: any = {
      collection: () => ({
        doc: () => ({}),
      }),
      runTransaction: async (cb: any) => {
        const tx = {
          get: async () => ({ exists: false, data: () => null }),
          set: (_doc: any, data: any) => { storedData = data; },
          update: vi.fn(),
        };
        return cb(tx);
      },
    };

    const limited = await isRateLimited('10.0.0.1', 'redeem_handoff', mockDb);
    expect(limited).toBe(false);
    expect(storedData).toMatchObject({ count: 1 });
  });

  it('blocks request when attempts within window exceed max limit', async () => {
    const mockDb: any = {
      collection: () => ({
        doc: () => ({}),
      }),
      runTransaction: async (cb: any) => {
        const tx = {
          get: async () => ({
            exists: true,
            data: () => ({ windowStart: Date.now() - 5000, count: 10 }),
          }),
          set: vi.fn(),
          update: vi.fn(),
        };
        return cb(tx);
      },
    };

    const limited = await isRateLimited('10.0.0.1', 'redeem_handoff', mockDb);
    expect(limited).toBe(true);
  });
});
