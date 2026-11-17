import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin', () => ({ firestore: vi.fn(() => ({})) }));
vi.mock('resend', () => ({ Resend: class {} }));
vi.mock('../../config/secrets', () => ({ resendApiKey: { value: () => '' } }));
vi.mock('../../lib/inngestClient', () => ({
    getInngestClient: () => ({ createFunction: (config: unknown) => config }),
}));

import { markDistributionJobFailed, processDistribution } from './inngest';

function fakeDb() {
    const update = vi.fn().mockResolvedValue(undefined);
    const paths: string[] = [];
    const node = (name: string): any => ({
        collection: (n: string) => { paths.push(n); return node(n); },
        doc: (id: string) => { paths.push(id); return { collection: (n: string) => { paths.push(n); return node(n); }, update }; },
    });
    return { db: node('root') as any, update, paths };
}

describe('processDistribution failure settlement', () => {
    it('marks the distribution failed with the error after retries are exhausted', async () => {
        const { db, update, paths } = fakeDb();
        const settled = await markDistributionJobFailed(
            db, { userId: 'u1', distributionId: 'd1' }, new Error('Distributor is not configured'),
        );
        expect(settled).toBe(true);
        expect(paths).toEqual(['users', 'u1', 'distributions', 'd1']);
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed', error: 'Distributor is not configured',
        }));
    });

    it('does nothing when the original payload lacks identifiers', async () => {
        const { db, update } = fakeDb();
        expect(await markDistributionJobFailed(db, {}, new Error('x'))).toBe(false);
        expect(await markDistributionJobFailed(db, undefined, new Error('x'))).toBe(false);
        expect(update).not.toHaveBeenCalled();
    });

    it('registers the settlement as the job onFailure handler', () => {
        const config = processDistribution as unknown as { onFailure?: unknown; retries: number };
        expect(typeof config.onFailure).toBe('function');
    });
});
