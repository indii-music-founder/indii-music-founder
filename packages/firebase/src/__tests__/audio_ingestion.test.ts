import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin', () => ({
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: Object.assign(vi.fn(), {
        FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    }),
    storage: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    },
}));

vi.mock('@google-cloud/tasks', () => ({
    CloudTasksClient: vi.fn(),
}));

import { queueVerifiedAudioIngestion, type CloudTasksClientLike } from '../distribution/ingestion';

const HASH = 'a'.repeat(64);
const STORAGE_PATH = `masters/owner-1/${HASH}/original.wav`;
const STORAGE_BUCKET = 'indii-test.firebasestorage.app';
const VALID_ENV = {
    GCLOUD_PROJECT: 'indii-test',
    ENGINE_DSP_URL: 'https://engine-dsp-abc-uc.a.run.app/profile',
    ENGINE_DSP_SERVICE_ACCOUNT: 'audio-task-invoker@indii-test.iam.gserviceaccount.com',
};

function tasksFixture() {
    return {
        queuePath: vi.fn(() => 'projects/indii-test/locations/us-central1/queues/dsp-processing-queue'),
        // Declaring the parameter (unused, but typed as the real request shape) is
        // what makes `.mock.calls[0][0]` resolve to that shape rather than an empty
        // tuple — `vi.fn` infers `mock.calls`'s element type from the wrapped
        // function's own parameter list, and this fixture previously took none.
        createTask: vi.fn(async (_request: Parameters<CloudTasksClientLike['createTask']>[0]) => [{}]),
    };
}

describe('queueVerifiedAudioIngestion', () => {
    it('fails closed on missing engine configuration before it verifies or streams a master', async () => {
        const verifyMaster = vi.fn();
        const tasksClient = tasksFixture();

        await expect(queueVerifiedAudioIngestion('owner-1', {
            storagePath: STORAGE_PATH,
            masterFingerprint: 'SONIC-1',
        }, {
            env: { GCLOUD_PROJECT: 'indii-test' },
            verifyMaster,
            tasksClient,
        })).rejects.toThrow(/ENGINE_DSP_URL/);

        expect(verifyMaster).not.toHaveBeenCalled();
        expect(tasksClient.createTask).not.toHaveBeenCalled();
    });

    it('cannot queue another user\'s content-addressed master', async () => {
        const tasksClient = tasksFixture();
        const verifyMaster = vi.fn(async (userId: string, input: { storagePath: string }) => {
            if (!input.storagePath.startsWith(`masters/${userId}/`)) {
                throw new Error('The master storage path does not belong to this owner and digest.');
            }
            throw new Error('unexpected');
        });

        await expect(queueVerifiedAudioIngestion('attacker', {
            storagePath: STORAGE_PATH,
            masterFingerprint: 'SONIC-1',
        }, {
            env: VALID_ENV,
            storageBucket: STORAGE_BUCKET,
            verifyMaster: verifyMaster as never,
            tasksClient,
        })).rejects.toThrow(/does not belong/);

        expect(tasksClient.createTask).not.toHaveBeenCalled();
    });

    it('queues only the verified immutable reference with an OIDC identity token', async () => {
        const tasksClient = tasksFixture();
        const verifyMaster = vi.fn(async () => ({
            verified: true as const,
            storagePath: STORAGE_PATH,
            contentHash: HASH,
            generation: '987654321',
        }));

        const result = await queueVerifiedAudioIngestion('owner-1', {
            storagePath: STORAGE_PATH,
            masterFingerprint: 'SONIC-1',
        }, {
            env: VALID_ENV,
            storageBucket: STORAGE_BUCKET,
            verifyMaster,
            tasksClient,
        });

        expect(verifyMaster).toHaveBeenCalledWith('owner-1', {
            storagePath: STORAGE_PATH,
            expectedSha256: HASH,
            masterFingerprint: 'SONIC-1',
        });
        expect(tasksClient.createTask).toHaveBeenCalledOnce();

        const request = tasksClient.createTask.mock.calls[0]?.[0];
        expect(request?.parent).toContain('/dsp-processing-queue');
        expect(request?.task.dispatchDeadline).toEqual({ seconds: 1_800 });
        expect(request?.task.httpRequest).toEqual(expect.objectContaining({
            url: VALID_ENV.ENGINE_DSP_URL,
            oidcToken: {
                serviceAccountEmail: VALID_ENV.ENGINE_DSP_SERVICE_ACCOUNT,
                audience: 'https://engine-dsp-abc-uc.a.run.app',
            },
        }));
        const payload = JSON.parse(Buffer.from(request?.task.httpRequest.body ?? '', 'base64').toString('utf8'));
        expect(payload).toEqual({
            storageBucket: STORAGE_BUCKET,
            storagePath: STORAGE_PATH,
            masterFingerprint: 'SONIC-1',
            contentHash: HASH,
            generation: '987654321',
            ownerId: 'owner-1',
        });
        expect(result).toEqual(expect.objectContaining({
            success: true,
            contentHash: HASH,
            generation: '987654321',
        }));
    });
});
