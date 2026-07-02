import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ISSUE-655: the queueRightsRegistration backend records honest manual_required
// registration requests. It must never claim 'registered'/'enrolled' and must
// never call a provider API (none is integrated — see the honesty contract).

const mocks = vi.hoisted(() => {
    const setCalls: Array<{ path: string; data: Record<string, unknown>; options: unknown }> = [];
    const docMock = vi.fn((path: string) => ({
        set: vi.fn(async (data: Record<string, unknown>, options: unknown) => {
            setCalls.push({ path, data, options });
        }),
    }));
    return { setCalls, docMock };
});

vi.mock('firebase-admin', () => ({
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: Object.assign(
        vi.fn(() => ({ doc: mocks.docMock })),
        { FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') } }
    ),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_opts: unknown, handler: unknown) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
            this.name = 'HttpsError';
        }
    },
}));

vi.mock('firebase-functions', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    parseRightsProvider,
    sanitizeRightsMetadata,
    processQueueRightsRegistration,
} from '../functions/rights/queueRightsRegistration';

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    mocks.setCalls.length = 0;
    mocks.docMock.mockClear();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw new Error('No provider API is integrated — fetch is forbidden here (ISSUE-655)');
    });
});

afterEach(() => {
    fetchSpy.mockRestore();
});

describe('parseRightsProvider', () => {
    it('accepts the three queueable providers', () => {
        expect(parseRightsProvider('ascap')).toBe('ascap');
        expect(parseRightsProvider('bmi')).toBe('bmi');
        expect(parseRightsProvider('soundexchange')).toBe('soundexchange');
    });

    it('rejects unknown providers', () => {
        expect(() => parseRightsProvider('spotify')).toThrowError(/provider must be one of/);
        expect(() => parseRightsProvider(undefined)).toThrowError(/provider must be one of/);
    });
});

describe('sanitizeRightsMetadata', () => {
    it('requires trackTitle', () => {
        expect(() => sanitizeRightsMetadata({})).toThrowError(/trackTitle is required/);
        expect(() => sanitizeRightsMetadata({ trackTitle: '   ' })).toThrowError(/trackTitle is required/);
        expect(() => sanitizeRightsMetadata('nope')).toThrowError(/metadata must be an object/);
    });

    it('whitelists fields and drops credential-shaped keys', () => {
        const sanitized = sanitizeRightsMetadata({
            trackTitle: 'Alpha Track',
            isrc: 'US-RC1-23-00001',
            apiKey: 'sk_live_evil',
            password: 'hunter2',
            accountId: 'ACC-1',
        });

        expect(sanitized).toEqual({
            trackTitle: 'Alpha Track',
            iswc: undefined,
            isrc: 'US-RC1-23-00001',
            upc: undefined,
            composerName: undefined,
            composerIPI: undefined,
            artistName: undefined,
            labelName: undefined,
            publisherName: undefined,
            publisherShare: undefined,
            releaseDate: undefined,
        });
        expect(Object.keys(sanitized)).not.toContain('apiKey');
        expect(Object.keys(sanitized)).not.toContain('password');
    });
});

describe('processQueueRightsRegistration', () => {
    const metadata = sanitizeRightsMetadata({
        trackTitle: 'Alpha Track',
        isrc: 'US-RC1-23-00001',
        artistName: 'Indie Artist',
    });

    it('writes an honest manual_required request doc and never claims registered', async () => {
        const response = await processQueueRightsRegistration('user-1', 'ascap', metadata);

        expect(mocks.setCalls).toHaveLength(1);
        const write = mocks.setCalls[0];
        expect(write.path).toBe('users/user-1/proRegistrations/ascap-us_rc1_23_00001');
        expect(write.data.status).toBe('manual_required');
        expect(write.data.organization).toBe('ASCAP');
        expect(write.options).toEqual({ merge: true });

        expect(response.status).toBe('manual_required');
        expect(response.queued).toBe(true);
        expect(response.manualUrl).toContain('ascap.com');
        // No fabricated registration artifacts
        expect(JSON.stringify(response)).not.toMatch(/registered|enrolled/);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('uses the SoundExchange enrollment collection for soundexchange', async () => {
        await processQueueRightsRegistration('user-1', 'soundexchange', metadata);

        expect(mocks.setCalls[0].path).toBe('users/user-1/soundExchangeEnrollments/soundexchange-us_rc1_23_00001');
        expect(mocks.setCalls[0].data.status).toBe('manual_required');
    });

    it('is idempotent: the same work re-queued writes the same deterministic doc path', async () => {
        await processQueueRightsRegistration('user-1', 'bmi', metadata);
        await processQueueRightsRegistration('user-1', 'bmi', metadata);

        expect(mocks.setCalls).toHaveLength(2);
        expect(mocks.setCalls[0].path).toBe(mocks.setCalls[1].path);
        expect(mocks.setCalls[1].options).toEqual({ merge: true });
    });

    it('falls back to the sanitized title when no isrc/iswc exists', async () => {
        const titled = sanitizeRightsMetadata({ trackTitle: 'My Song (Live!)' });
        await processQueueRightsRegistration('user-1', 'ascap', titled);

        expect(mocks.setCalls[0].path).toBe('users/user-1/proRegistrations/ascap-my_song_live_');
    });
});
