import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TuneCoreAdapter } from './TuneCoreAdapter';

/**
 * ISSUE-814: BaseDistributorAdapter.connect() marks any adapter "connected"
 * from mere apiKey presence, with zero verification. Believe/OneRPM/
 * UnitedMasters already override connect() to ping their real API and
 * reject on 401/403 — TuneCore had the identical apiBaseUrl infrastructure
 * but never did this check, so a typo'd or expired key still reported
 * connected: true. These prove TuneCore now uses the same real check.
 */
describe('TuneCoreAdapter.connect (ISSUE-814)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('rejects and clears credentials when the API reports an invalid key (401)', async () => {
        vi.mocked(fetch).mockResolvedValue({ status: 401, ok: false } as Response);
        const adapter = new TuneCoreAdapter();

        await expect(adapter.connect({ apiKey: 'bad-key' })).rejects.toThrow(/Invalid API key/);
        await expect(adapter.isConnected()).resolves.toBe(false);
    });

    it('rejects when the API reports a forbidden key (403)', async () => {
        vi.mocked(fetch).mockResolvedValue({ status: 403, ok: false } as Response);
        const adapter = new TuneCoreAdapter();

        await expect(adapter.connect({ apiKey: 'expired-key' })).rejects.toThrow(/Invalid API key/);
        await expect(adapter.isConnected()).resolves.toBe(false);
    });

    it('stays connected when the API confirms a valid key', async () => {
        vi.mocked(fetch).mockResolvedValue({ status: 200, ok: true } as Response);
        const adapter = new TuneCoreAdapter();

        await expect(adapter.connect({ apiKey: 'good-key' })).resolves.not.toThrow();
        await expect(adapter.isConnected()).resolves.toBe(true);
    });

    it('does not block connection on a network error (best-effort probe, matches sibling adapters)', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('network unreachable'));
        const adapter = new TuneCoreAdapter();

        await expect(adapter.connect({ apiKey: 'unverifiable-key' })).resolves.not.toThrow();
        await expect(adapter.isConnected()).resolves.toBe(true);
    });
});
