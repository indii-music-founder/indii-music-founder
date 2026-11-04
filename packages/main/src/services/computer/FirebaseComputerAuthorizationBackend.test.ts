import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirebaseComputerAuthorizationBackend } from './FirebaseComputerAuthorizationBackend';
import type { StoredComputerApproval } from './ComputerAuthorizationService';

const approval: StoredComputerApproval = {
    id: 'approval-1', userId: 'artist-1', agentId: 'agent-1', toolName: 'computer.click',
    args: { x: 10, y: 20 }, status: 'pending', createdAtMs: Date.now(),
};

afterEach(() => vi.unstubAllGlobals());

describe('FirebaseComputerAuthorizationBackend request deadlines', () => {
    it('bounds a stalled Firestore lookup', async () => {
        vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        })));

        await expect(new FirebaseComputerAuthorizationBackend('test-project', 20)
            .getApproval('artist-1', approval.id, 'id-token')).rejects.toMatchObject({ name: 'TimeoutError' });
    });

    it('bounds a stalled trusted claim response body', async () => {
        vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => Promise.resolve({
            ok: true,
            status: 200,
            json: () => new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
            }),
        })));

        await expect(new FirebaseComputerAuthorizationBackend('test-project', 20)
            .claimApproval('artist-1', approval, 'id-token')).rejects.toThrow('Trusted approval claim response was unavailable; check the approval state before retrying.');
    });
});
