import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: vi.fn(() => vi.fn()) }));
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(),
    FieldValue: { arrayUnion: vi.fn() },
}));
vi.mock('firebase-functions', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { applyStatusHeuristic, PENDING_STATUSES, checkDistributorStatus } from './pollDeliveryStatus';

const hoursAgo = (h: number) => Date.now() - h * 60 * 60 * 1000;

describe('applyStatusHeuristic (ISSUE-1288)', () => {
    it('never promotes a release to the terminal "live" state on a guess', () => {
        // Well past DistroKid's 48h lead time, but no DSP ever confirmed anything.
        const result = applyStatusHeuristic('in_review', 'distrokid', hoursAgo(500));

        expect(result).not.toBe('live');
        expect(result).toBe('likely_live');
    });

    it('promotes to likely_live only after the distributor lead time elapses', () => {
        // TuneCore lead time is 72h.
        expect(applyStatusHeuristic('in_review', 'tunecore', hoursAgo(71))).toBe('in_review');
        expect(applyStatusHeuristic('in_review', 'tunecore', hoursAgo(73))).toBe('likely_live');
    });

    it('respects per-distributor lead times rather than one global timer', () => {
        // At 100h: past tunecore's 72h, still short of cdbaby's 240h.
        expect(applyStatusHeuristic('in_review', 'tunecore', hoursAgo(100))).toBe('likely_live');
        expect(applyStatusHeuristic('in_review', 'cdbaby', hoursAgo(100))).toBe('in_review');
    });

    it('keeps polling likely_live so a real confirmation can still arrive', () => {
        // If this dropped out of the polled set, a guessed release could never be
        // corrected or upgraded to a confirmed 'live'.
        expect(PENDING_STATUSES).toContain('likely_live');
    });

    it('leaves likely_live untouched — only a real API status may move it on', () => {
        expect(applyStatusHeuristic('likely_live', 'distrokid', hoursAgo(9999))).toBe('likely_live');
    });

    it('advances pending to in_review after the initial window', () => {
        expect(applyStatusHeuristic('pending', 'distrokid', hoursAgo(1))).toBe('pending');
        expect(applyStatusHeuristic('pending', 'distrokid', hoursAgo(3))).toBe('in_review');
    });

    it('does not guess at all when the delivery time is unknown', () => {
        expect(applyStatusHeuristic('in_review', 'distrokid', undefined)).toBe('in_review');
    });
});

describe('checkDistributorStatus (ISSUE-1569)', () => {
    it('returns null when apiKey or distributorReleaseId is missing', async () => {
        expect(await checkDistributorStatus('tunecore', '', 'api_key_123')).toBeNull();
        expect(await checkDistributorStatus('tunecore', 'rel_123', undefined)).toBeNull();
    });

    it('returns null for an unsupported distributor', async () => {
        expect(await checkDistributorStatus('unknown_distributor', 'rel_123', 'api_key_123')).toBeNull();
    });

    it('encodes distributorReleaseId and includes authorization header', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'live' }),
        });
        const originalFetch = global.fetch;
        global.fetch = mockFetch as unknown as typeof fetch;

        try {
            const status = await checkDistributorStatus('tunecore', 'rel/123?foo=bar', 'test_key');
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.tunecore.com/v1/releases/rel%2F123%3Ffoo%3Dbar',
                expect.objectContaining({
                    headers: { Authorization: 'Bearer test_key' },
                    signal: expect.anything(),
                })
            );
            expect(status).toBe('live');
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('returns null when API returns a non-ok HTTP status', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
        });
        const originalFetch = global.fetch;
        global.fetch = mockFetch as unknown as typeof fetch;

        try {
            const status = await checkDistributorStatus('onerpm', 'rel_404', 'test_key');
            expect(status).toBeNull();
        } finally {
            global.fetch = originalFetch;
        }
    });
});
