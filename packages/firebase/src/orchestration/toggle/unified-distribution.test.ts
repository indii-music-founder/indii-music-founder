import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((handler: unknown) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    },
}));

import { triggerUnifiedDistribution } from './unified-distribution.js';

describe('triggerUnifiedDistribution', () => {
    it('fails closed instead of staging an unvalidated secondary DDEX package', async () => {
        const handler = triggerUnifiedDistribution as unknown as (request: {
            auth: { uid: string };
            data: { releaseId: string };
        }) => Promise<unknown>;

        await expect(handler({ auth: { uid: 'owner-1' }, data: { releaseId: 'release-1' } }))
            .rejects.toMatchObject({
                code: 'failed-precondition',
                message: expect.stringMatching(/canonical DDEX delivery/i),
            });
    });
});
