import { describe, expect, it, vi } from 'vitest';

import { redeemStoredHandoff, type HandoffRedemptionDependencies } from './handoff';

const NOW = new Date('2026-08-24T00:16:00.000Z');

function dependencies(
  overrides: Partial<HandoffRedemptionDependencies> = {},
): HandoffRedemptionDependencies {
  return {
    load: vi.fn().mockResolvedValue({
      userId: 'founder-1',
      idToken: 'desktop-id-token',
      accessToken: null,
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
  it('does not consume the handoff when custom-token minting fails', async () => {
    const mintError = new Error('iam.serviceAccounts.signBlob denied');
    const deps = dependencies({
      mintCustomToken: vi.fn().mockRejectedValue(mintError),
    });

    await expect(redeemStoredHandoff(deps)).rejects.toBe(mintError);
    expect(deps.consume).not.toHaveBeenCalled();
    expect(deps.expire).not.toHaveBeenCalled();
  });

  it('returns credentials only after the one-time record is atomically consumed', async () => {
    const deps = dependencies();

    await expect(redeemStoredHandoff(deps)).resolves.toEqual({
      status: 200,
      customToken: 'phone-custom-token',
      idToken: 'desktop-id-token',
      accessToken: null,
    });
    expect(deps.mintCustomToken).toHaveBeenCalledWith('founder-1');
    expect(deps.consume).toHaveBeenCalledWith('founder-1', NOW);
  });

  it('never returns a token when another request wins the consume race', async () => {
    const deps = dependencies({ consume: vi.fn().mockResolvedValue(false) });

    await expect(redeemStoredHandoff(deps)).resolves.toEqual({
      status: 404,
      message: 'Invalid or expired code',
    });
  });

  it('expires stale records without minting a token', async () => {
    const deps = dependencies({
      load: vi.fn().mockResolvedValue({
        userId: 'founder-1',
        idToken: 'desktop-id-token',
        accessToken: null,
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
});
