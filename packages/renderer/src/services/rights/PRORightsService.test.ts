import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    registerWithASCAP,
    registerWithBMI,
    enrollWithSoundExchange,
    verifyCoverSongLicense,
    runRightsCheck,
} from '@/services/rights/PRORightsService';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

// ISSUE-655 boundary contract: the renderer sends release METADATA to backend
// callables only. It must never read provider credentials from Firestore and
// never fetch provider APIs directly.

const mocks = vi.hoisted(() => {
    const callableHandlers = new Map<string, ReturnType<typeof vi.fn>>();
    const httpsCallable = vi.fn((_functions: unknown, name: string) => {
        if (!callableHandlers.has(name)) {
            callableHandlers.set(name, vi.fn(async () => ({ data: {} })));
        }
        return callableHandlers.get(name)!;
    });
    type MockSnapshot = { exists: () => boolean; data: () => Record<string, unknown> | undefined };
    const getDoc = vi.fn(async (): Promise<MockSnapshot> => ({ exists: () => false, data: () => undefined }));
    const doc = vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }));
    return { callableHandlers, httpsCallable, getDoc, doc };
});

vi.mock('@/services/firebase', () => ({
    db: { type: 'firestore' },
    functions: { type: 'functions' },
    auth: { currentUser: { uid: 'user-1', email: 'artist@example.com' } },
    storage: {},
    functionsWest1: {},
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
}));

vi.mock('firebase/firestore', () => ({
    doc: mocks.doc,
    getDoc: mocks.getDoc,
}));

const queuedResponse = (provider: string, organization: string) => ({
    data: {
        queued: true,
        provider,
        status: 'manual_required',
        organization,
        manualUrl: `https://portal.example/${provider}`,
        guidance: `Automated ${organization} registration is not available. Register manually.`,
        recordPath: `users/user-1/proRegistrations/${provider}-x`,
        submittedAt: 1,
    },
});

const metadata = {
    trackTitle: 'Alpha Track',
    artistName: 'Indie Artist',
    isrc: 'US-RC1-23-00001',
    iswc: 'T-000000001-1',
    composerName: 'Composer One',
    labelName: 'indii',
} as ExtendedGoldenMetadata;

/** Recursively collect every object key in a payload. */
function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
        value.forEach(v => collectKeys(v, keys));
    } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            keys.add(k);
            collectKeys(v, keys);
        }
    }
    return keys;
}

const CREDENTIAL_KEYS = ['apiKey', 'password', 'username', 'accountId', 'memberId', 'publisherNumber', 'token', 'secret'];

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    mocks.callableHandlers.clear();
    mocks.httpsCallable.mockClear();
    mocks.getDoc.mockClear();
    mocks.doc.mockClear();
    mocks.getDoc.mockImplementation(async () => ({ exists: () => false, data: () => undefined }));
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw new Error('Direct fetch from the rights renderer service is forbidden (ISSUE-655)');
    });
});

afterEach(() => {
    fetchSpy.mockRestore();
});

describe('PRORightsService — queued PRO registration (ISSUE-655)', () => {
    it('registerWithASCAP sends whitelisted metadata to queueRightsRegistration and returns an honest manual state', async () => {
        mocks.httpsCallable(null, 'queueRightsRegistration');
        mocks.callableHandlers.get('queueRightsRegistration')!.mockResolvedValue(queuedResponse('ascap', 'ASCAP'));

        const result = await registerWithASCAP('user-1', metadata);

        const handler = mocks.callableHandlers.get('queueRightsRegistration')!;
        expect(handler).toHaveBeenCalledTimes(1);
        const payload = handler.mock.calls[0][0];
        expect(payload.provider).toBe('ascap');
        expect(payload.metadata.trackTitle).toBe('Alpha Track');
        expect(payload.metadata.isrc).toBe('US-RC1-23-00001');

        // Honest state: queued for manual completion, never claimed registered
        expect(result.success).toBe(false);
        expect(result.requiresManualReview).toBe(true);
        expect(result.organization).toBe('ASCAP');
        expect(result.error).toContain('Register manually');
        expect(result.workId).toBeUndefined();
    });

    it('never sends credential-shaped keys and never touches Firestore or fetch during registration', async () => {
        mocks.httpsCallable(null, 'queueRightsRegistration');
        mocks.callableHandlers.get('queueRightsRegistration')!.mockResolvedValue(queuedResponse('bmi', 'BMI'));

        await registerWithBMI('user-1', metadata);

        const payload = mocks.callableHandlers.get('queueRightsRegistration')!.mock.calls[0][0];
        const keys = collectKeys(payload);
        for (const credentialKey of CREDENTIAL_KEYS) {
            expect(keys.has(credentialKey)).toBe(false);
        }

        // No proCredentials reads, no direct provider calls
        expect(mocks.getDoc).not.toHaveBeenCalled();
        expect(mocks.doc).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('enrollWithSoundExchange queues honestly and surfaces backend guidance', async () => {
        mocks.httpsCallable(null, 'queueRightsRegistration');
        mocks.callableHandlers.get('queueRightsRegistration')!.mockResolvedValue(queuedResponse('soundexchange', 'SoundExchange'));

        const result = await enrollWithSoundExchange('user-1', metadata);

        expect(mocks.callableHandlers.get('queueRightsRegistration')!.mock.calls[0][0].provider).toBe('soundexchange');
        expect(result.success).toBe(false);
        expect(result.enrollmentId).toBeUndefined();
        expect(result.error).toContain('SoundExchange');
    });

    it('returns an honest failure with the manual portal when the backend is unavailable', async () => {
        mocks.httpsCallable(null, 'queueRightsRegistration');
        mocks.callableHandlers.get('queueRightsRegistration')!.mockRejectedValue(new Error('internal'));

        const result = await registerWithASCAP('user-1', metadata);

        expect(result.success).toBe(false);
        expect(result.requiresManualReview).toBe(true);
        expect(result.error).toContain('https://www.ascap.com/myascap');
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('PRORightsService — cover song verification (ISSUE-655 / ISSUE-419)', () => {
    const coverMetadata = {
        ...metadata,
        isCoverSong: true,
        originalSongTitle: 'Original Song',
    } as ExtendedGoldenMetadata;

    it('non-cover songs are verified without any backend or Firestore access', async () => {
        const result = await verifyCoverSongLicense('user-1', metadata);

        expect(result).toMatchObject({ isVerified: true, requiresLicense: false });
        expect(mocks.httpsCallable).not.toHaveBeenCalled();
        expect(mocks.getDoc).not.toHaveBeenCalled();
    });

    it("a manually confirmed license in the user's own coverLicenses doc verifies the cover", async () => {
        mocks.getDoc.mockImplementation(async () => ({
            exists: () => true,
            data: () => ({ status: 'confirmed', licenseNumber: 'LIC-42' }),
        }));

        const result = await verifyCoverSongLicense('user-1', coverMetadata);

        expect(mocks.doc.mock.calls[0].slice(1)).toEqual(['users', 'user-1', 'coverLicenses', 'US-RC1-23-00001']);
        expect(result).toMatchObject({ isVerified: true, licenseNumber: 'LIC-42', licenseType: 'direct', requiresLicense: true });
        expect(mocks.callableHandlers.has('verifyMechanicalLicense')).toBe(false);
    });

    it('without manual confirmation the backend UNVERIFIED response stays unverified', async () => {
        mocks.httpsCallable(null, 'verifyMechanicalLicense');
        mocks.callableHandlers.get('verifyMechanicalLicense')!.mockResolvedValue({
            data: { status: 'UNVERIFIED', requiresClearance: true, songCode: null, publisher: null, rate: 0.124, guidance: 'Obtain a mechanical license via SongFile / The MLC.' },
        });

        const result = await verifyCoverSongLicense('user-1', coverMetadata);

        const call = mocks.callableHandlers.get('verifyMechanicalLicense')!.mock.calls[0][0];
        expect(call).toEqual({ trackTitle: 'Original Song', originalArtist: 'Indie Artist' });
        expect(result.isVerified).toBe(false);
        expect(result.requiresLicense).toBe(true);
        expect(result.error).toContain('mechanical license');
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('PRORightsService — runRightsCheck aggregation', () => {
    it('blocks delivery for unverified covers and surfaces manual-review warnings', async () => {
        mocks.httpsCallable(null, 'queueRightsRegistration');
        mocks.callableHandlers.get('queueRightsRegistration')!.mockResolvedValue(queuedResponse('ascap', 'ASCAP'));
        mocks.httpsCallable(null, 'verifyMechanicalLicense');
        mocks.callableHandlers.get('verifyMechanicalLicense')!.mockResolvedValue({
            data: { status: 'UNVERIFIED', requiresClearance: true, songCode: null, publisher: null, rate: 0.124, guidance: 'Clear it first.' },
        });

        const result = await runRightsCheck('user-1', { ...metadata, isCoverSong: true } as ExtendedGoldenMetadata, 'ASCAP');

        expect(result.overallBlocking).toBe(true);
        expect(result.warnings).toContain('Cover song delivery is blocked: mechanical license required');
        expect(result.warnings).toContain('ASCAP registration requires manual review');
        expect(result.ascap?.success).toBe(false);
        expect(result.soundExchange?.success).toBe(false);
    });
});
