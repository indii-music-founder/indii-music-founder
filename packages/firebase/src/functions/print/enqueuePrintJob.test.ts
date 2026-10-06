import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';

// Mock storageUri functions
vi.mock('../../lib/storageUri', () => ({
    parseStorageUri: vi.fn((uri: string) => {
        if (!uri.startsWith('gs://')) throw new Error('Invalid storage URI');
        const parts = uri.slice(5).split('/');
        return { bucket: parts[0], path: parts.slice(1).join('/') };
    }),
    assertUserOwnsStoragePath: vi.fn((path: string, userId: string) => {
        if (!path.startsWith(`users/${userId}/`) && !path.startsWith(`creative/${userId}/`)) {
            throw new Error('Permission denied');
        }
    }),
}));

// Mock rate limit
vi.mock('../../lib/rateLimit', () => ({
    enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

// Mock enforceOperationCost
vi.mock('../billing/enforceOperationCost', () => ({
    requireVerifiedCreativeUser: vi.fn((auth: any) => {
        if (!auth?.uid) throw new Error('Unauthenticated');
        return auth.uid;
    }),
}));

// Mock appCheck
vi.mock('../../middleware/appCheck', () => ({
    validateAppCheckV2: vi.fn(),
}));

import { enqueuePrintJob, setPrintTasksClientFactoryForTests } from './enqueuePrintJob';

// STRUCTURAL ONLY: this legacy suite uses mock auth, Firestore and Cloud Tasks;
// it verifies callable validation, not a real print job or production dispatch.
const originalWorkerEnv = {
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    PRINT_WORKER_URL: process.env.PRINT_WORKER_URL,
    PRINT_WORKER_SERVICE_ACCOUNT: process.env.PRINT_WORKER_SERVICE_ACCOUNT,
};

describe('enqueuePrintJob Callable Function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GCLOUD_PROJECT = 'structural-test-project';
        process.env.PRINT_WORKER_URL = 'https://print-worker.invalid';
        process.env.PRINT_WORKER_SERVICE_ACCOUNT = 'print-worker@structural-test-project.iam.gserviceaccount.com';
        setPrintTasksClientFactoryForTests(() => ({
            queuePath: (project, location, queue) => `projects/${project}/locations/${location}/queues/${queue}`,
            createTask: async () => ({}),
        }));
    });

    afterAll(() => {
        for (const [key, original] of Object.entries(originalWorkerEnv)) {
            if (original === undefined) delete process.env[key];
            else process.env[key] = original;
        }
    });

    it('successfully validates request and enqueues print job to Firestore', async () => {
        const handler = (enqueuePrintJob as any).run;
        const mockRequest = {
            auth: {
                uid: 'artist-user-123',
                token: { email_verified: true },
            },
            data: {
                imageUri: 'gs://indii-bucket/users/artist-user-123/artwork.png',
                presetId: 'vinyl_sleeve',
                bleedMode: 'extend',
                focusX: 0.5,
                focusY: 0.5,
                generateGuide: true,
            },
        };

        const result = await handler(mockRequest);

        expect(result).toBeDefined();
        expect(result.jobId).toMatch(/^print_/);
        expect(result.status).toBe('queued');
        expect(result.estimatedDurationSec).toBe(25);
        expect(result.plan).toBeDefined();
        expect(result.plan.requiredWidthPx).toBe(3788);
        expect(result.plan.requiredHeightPx).toBe(3788);
        expect(result.plan.dpi).toBe(300);
    });

    it('rejects unauthenticated requests', async () => {
        const handler = (enqueuePrintJob as any).run;
        const mockRequest = {
            auth: null,
            data: {
                imageUri: 'gs://indii-bucket/users/artist-user-123/artwork.png',
                presetId: 'vinyl_sleeve',
            },
        };

        await expect(handler(mockRequest)).rejects.toThrow();
    });

    it('rejects invalid or unknown print presets', async () => {
        const handler = (enqueuePrintJob as any).run;
        const mockRequest = {
            auth: {
                uid: 'artist-user-123',
                token: { email_verified: true },
            },
            data: {
                imageUri: 'gs://indii-bucket/users/artist-user-123/artwork.png',
                presetId: 'nonexistent_preset_xyz',
            },
        };

        await expect(handler(mockRequest)).rejects.toThrow(/Unknown print preset/);
    });
});
