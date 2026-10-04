import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import { enqueuePrintJob } from './enqueuePrintJob';

describe('enqueuePrintJob Callable Function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
