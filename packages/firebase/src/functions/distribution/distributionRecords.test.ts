import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => {
    type SetCall = {
        ref: { path: string };
        data: Record<string, unknown>;
        options?: Record<string, unknown>;
    };

    const setCalls: SetCall[] = [];

    const makeRef = (path: string): { path: string; get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> }>; collection: (name: string) => ReturnType<typeof makeCollection> } => ({
        path,
        get: vi.fn(async () => ({
            exists: path === 'proprietaryIngestionReleases/release-1',
            data: () => path === 'proprietaryIngestionReleases/release-1' ? { userId: 'user-1' } : {},
        })),
        collection: (name: string) => makeCollection(`${path}/${name}`),
    });

    const makeCollection = (path: string) => ({
        doc: vi.fn((id?: string) => makeRef(`${path}/${id ?? `auto-${path.replace(/\W+/g, '-')}`}`)),
    });

    const db = {
        doc: vi.fn((path: string) => makeRef(path)),
        collection: vi.fn((path: string) => makeCollection(path)),
        runTransaction: vi.fn(async (callback: (tx: { set: typeof txSet }) => Promise<void>) => callback({ set: txSet })),
    };

    function txSet(ref: { path: string }, data: Record<string, unknown>, options?: Record<string, unknown>) {
        setCalls.push({ ref, data, options });
    }

    return { db, setCalls };
});

vi.mock('firebase-admin', () => ({
    firestore: Object.assign(
        vi.fn(() => firestoreMocks.db),
        {
            FieldValue: {
                serverTimestamp: vi.fn(() => 'TIMESTAMP'),
            },
        }
    ),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((handler: unknown) => handler),
    HttpsError: class extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    },
}));

describe('distributionRecords', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        firestoreMocks.setCalls.length = 0;
    });

    it('records takedown requests without marking the release as provider-requested', async () => {
        const { requestDistributionTakedown } = await import('./distributionRecords');

        // Gen2 callables receive a single CallableRequest ({ data, auth, ... })
        // rather than Gen1's (data, context) pair.
        const result = await (requestDistributionTakedown as unknown as (
            request: { data: Record<string, unknown>; auth: { uid: string } }
        ) => Promise<Record<string, unknown>>)({
            data: {
                releaseId: 'release-1',
                reason: 'voluntary withdrawal',
            },
            auth: { uid: 'user-1' },
        });

        const releaseWrite = firestoreMocks.setCalls.find(call => call.ref.path === 'proprietaryIngestionReleases/release-1');
        expect(result.status).toBe('PENDING_NOTIFICATION');
        expect(result.manualRequired).toBe(true);
        expect(releaseWrite?.data).toMatchObject({
            takedownStatus: 'pending_notification',
            takedownNotificationStatus: 'manual_required',
            takedownReason: 'voluntary withdrawal',
            takedownRecordedBy: 'user-1',
        });
        expect(releaseWrite?.data).not.toHaveProperty('status', 'takedown_requested');
        expect(firestoreMocks.setCalls.some(call => call.data.status === 'takedown_requested')).toBe(false);
    });
});
