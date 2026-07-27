import { describe, expect, it, vi } from 'vitest';

import {
    retryOwnedSessionProxyJob,
    type RetryableSessionOriginal,
    type VideoSessionProxyRetryStore,
} from './retrySessionProxyJob';
import type { FinalizedOriginalRef } from './finalizeVideoSessionUpload';

const OWNER = 'owner-uid-1';
const SESSION = 'a'.repeat(40);
const SHA = 'b'.repeat(64);

const original: FinalizedOriginalRef = {
    schemaVersion: 'canonical-media-ref.v1',
    role: 'original',
    ownerUid: OWNER,
    organizationId: 'org-default',
    projectId: 'project-1',
    bucket: 'indii-music-founder.firebasestorage.app',
    path: `session-media/${OWNER}/${SESSION}/original/${SHA}.mp4`,
    generation: '1700000000000001',
    sha256: SHA,
    mimeType: 'video/mp4',
    byteSize: 50_607,
    createdAt: '2026-07-27T00:00:00.000Z',
    creationReceiptId: 'receipt-1',
};

function storeReturning(value: RetryableSessionOriginal): VideoSessionProxyRetryStore {
    return { loadRetryable: vi.fn().mockResolvedValue(value) };
}

describe('retryOwnedSessionProxyJob', () => {
    it('re-dispatches a stranded blocked session through the same dispatcher', async () => {
        const dispatch = vi.fn().mockResolvedValue({
            jobId: 'proxy-abc',
            status: 'queued',
            reused: false,
        });

        const result = await retryOwnedSessionProxyJob(OWNER, { sessionId: SESSION }, {
            store: storeReturning({ sessionId: SESSION, original }),
            dispatch,
        });

        expect(result).toEqual({ jobId: 'proxy-abc', status: 'queued', reused: false });
        // The retry must not construct its own payload — dispatch keys both
        // idempotency layers off this exact original.
        expect(dispatch).toHaveBeenCalledWith(SESSION, original);
    });

    it('reports a still-blocked result verbatim rather than claiming success', async () => {
        const dispatch = vi.fn().mockResolvedValue({
            jobId: 'proxy-abc',
            status: 'blocked',
            reused: false,
            blockedReason: 'proxy-worker-not-configured',
        });

        const result = await retryOwnedSessionProxyJob(OWNER, { sessionId: SESSION }, {
            store: storeReturning({ sessionId: SESSION, original }),
            dispatch,
        });

        expect(result.status).toBe('blocked');
        expect(result.blockedReason).toBe('proxy-worker-not-configured');
    });

    it('stays a no-op when dispatch reports the job was already queued', async () => {
        const dispatch = vi.fn().mockResolvedValue({
            jobId: 'proxy-abc',
            status: 'queued',
            reused: true,
        });

        const result = await retryOwnedSessionProxyJob(OWNER, { sessionId: SESSION }, {
            store: storeReturning({ sessionId: SESSION, original }),
            dispatch,
        });

        expect(result.reused).toBe(true);
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('rejects a malformed session id before touching the store', async () => {
        const store = storeReturning({ sessionId: SESSION, original });
        const dispatch = vi.fn();

        await expect(
            retryOwnedSessionProxyJob(OWNER, { sessionId: 'not-a-session' }, { store, dispatch }),
        ).rejects.toThrow(/valid owner and video session ID/);

        expect(store.loadRetryable).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('rejects an empty owner uid', async () => {
        const store = storeReturning({ sessionId: SESSION, original });
        const dispatch = vi.fn();

        await expect(
            retryOwnedSessionProxyJob('', { sessionId: SESSION }, { store, dispatch }),
        ).rejects.toThrow(/valid owner and video session ID/);

        expect(dispatch).not.toHaveBeenCalled();
    });

    it('rejects unknown request fields instead of ignoring them', async () => {
        const store = storeReturning({ sessionId: SESSION, original });
        const dispatch = vi.fn();

        await expect(
            retryOwnedSessionProxyJob(
                OWNER,
                { sessionId: SESSION, force: true },
                { store, dispatch },
            ),
        ).rejects.toThrow(/valid owner and video session ID/);

        expect(dispatch).not.toHaveBeenCalled();
    });

    it('propagates the store rejection without dispatching', async () => {
        const store: VideoSessionProxyRetryStore = {
            loadRetryable: vi.fn().mockRejectedValue(new Error('A queued proxy job is already in flight')),
        };
        const dispatch = vi.fn();

        await expect(
            retryOwnedSessionProxyJob(OWNER, { sessionId: SESSION }, { store, dispatch }),
        ).rejects.toThrow(/already in flight/);

        expect(dispatch).not.toHaveBeenCalled();
    });
});
