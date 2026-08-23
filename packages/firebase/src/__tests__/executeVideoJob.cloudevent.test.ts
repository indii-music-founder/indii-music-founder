import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Direct v2 CloudEvent coverage for the `executeVideoJob` Firestore trigger in
 * index.ts (ISSUE-1243).
 *
 * Not to be confused with `gateway.ts`'s `executeVideoJob`, which shares the
 * name but is the Gen2 orchestrator's business-logic function and is covered
 * by gateway.test.ts. This file covers the trigger's *event contract*, which
 * is the part the Gen1 -> Gen2 migration actually changed:
 *
 *   Gen1: onCreate(async (snapshot, context) => ...)   snapshot always present
 *   Gen2: onDocumentCreated(opts, async (event) => ...) event.data is optional
 *
 * The absent-snapshot case is the one Gen1 could never produce, so nothing
 * existed to exercise it.
 */

const mocks = vi.hoisted(() => ({
    generateVideoDirect: vi.fn().mockResolvedValue(undefined),
    docSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/video_generation_direct', () => ({
    generateVideoDirect: mocks.generateVideoDirect,
}));

// Unwrap the trigger so the handler can be invoked with a hand-built event.
// Without this the real onDocumentCreated wrapper runs and tries to parse the
// object as a raw CloudEvent envelope (datacontenttype, specversion, ...),
// which is transport plumbing this test is not trying to cover.
vi.mock('firebase-functions/v2/firestore', () => ({
    onDocumentCreated: vi.fn((_opts: unknown, handler?: unknown) => handler ?? _opts),
    onDocumentUpdated: vi.fn((_opts: unknown, handler?: unknown) => handler ?? _opts),
    onDocumentDeleted: vi.fn((_opts: unknown, handler?: unknown) => handler ?? _opts),
    onDocumentWritten: vi.fn((_opts: unknown, handler?: unknown) => handler ?? _opts),
}));

vi.mock('firebase-admin', () => {
    const docRef = { set: mocks.docSet, update: vi.fn().mockResolvedValue(undefined), id: 'job-1' };
    const firestoreInstance = {
        collection: vi.fn(() => ({ doc: vi.fn(() => docRef) })),
        doc: vi.fn(() => docRef),
        runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({ get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }), set: vi.fn(), update: vi.fn() })),
    };
    const firestore = Object.assign(vi.fn(() => firestoreInstance), {
        FieldValue: { serverTimestamp: vi.fn(() => 'TS'), increment: vi.fn((n: number) => n) },
        Timestamp: { now: vi.fn(() => 'NOW'), fromMillis: vi.fn((m: number) => m) },
    });
    return {
        initializeApp: vi.fn(),
        firestore,
        auth: vi.fn(),
        appCheck: vi.fn(() => ({ verifyToken: vi.fn().mockResolvedValue({ appId: 'a' }) })),
        storage: vi.fn(() => ({ bucket: vi.fn(() => ({ file: vi.fn(() => ({})) })) })),
        apps: [{ name: '[DEFAULT]' }],
    };
});

import { executeVideoJob } from '../index';

/** Shapes a FirestoreEvent the way the v2 runtime delivers it. */
function cloudEvent(docData: Record<string, unknown> | undefined, jobId = 'job-1') {
    return {
        params: { jobId },
        data: docData === undefined ? undefined : { data: () => docData, id: jobId, exists: true },
    };
}

const invoke = (event: unknown) => (executeVideoJob as unknown as (e: unknown) => Promise<void>)(event);

describe('executeVideoJob — v2 CloudEvent contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.generateVideoDirect.mockResolvedValue(undefined);
    });

    it('no-ops when the event carries no snapshot', async () => {
        // Gen2 types event.data as optional; Gen1 always supplied it. Must not
        // dereference undefined, and must not start paid generation.
        await expect(invoke(cloudEvent(undefined))).resolves.toBeUndefined();
        expect(mocks.generateVideoDirect).not.toHaveBeenCalled();
        expect(mocks.docSet).not.toHaveBeenCalled();
    });

    it('skips a job whose status is not "queued"', async () => {
        await invoke(cloudEvent({ status: 'completed', userId: 'u1', prompt: 'p' }));
        expect(mocks.generateVideoDirect).not.toHaveBeenCalled();
    });

    it('skips versioned gateway jobs owned by the Gen2 orchestrator', async () => {
        await invoke(cloudEvent({ status: 'queued', userId: 'u1', prompt: 'p', workerVersion: 'gateway-video-v3' }));
        expect(mocks.generateVideoDirect).not.toHaveBeenCalled();

        await invoke(cloudEvent({ status: 'queued', userId: 'u1', prompt: 'p', type: 'video' }));
        expect(mocks.generateVideoDirect).not.toHaveBeenCalled();
    });

    it('skips typed jobs owned by dedicated workers (long_form, render_stitch)', async () => {
        // Long-form is owned by the Inngest daisychain; without the type stamp
        // + gate, the legacy worker started a SECOND billable Veo run racing it.
        await invoke(cloudEvent({ status: 'queued', userId: 'u1', prompt: 'p', type: 'long_form', isLongForm: true }));
        expect(mocks.generateVideoDirect).not.toHaveBeenCalled();

        // Render-stitch docs carry no prompt; the legacy worker used to
        // auto-fail them (a terminal write) before the stitch pipeline ran.
        await invoke(cloudEvent({ status: 'queued', userId: 'u1', type: 'render_stitch' }));
        expect(mocks.generateVideoDirect).not.toHaveBeenCalled();
        expect(mocks.docSet).not.toHaveBeenCalled();
    });

    it('fails the job closed when required fields are missing, without generating', async () => {
        await invoke(cloudEvent({ status: 'queued', prompt: 'p' })); // no userId
        expect(mocks.generateVideoDirect).not.toHaveBeenCalled();
        expect(mocks.docSet).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'failed' }),
            { merge: true },
        );
    });

    it('runs generation for an unversioned queued job, reading params from the event', async () => {
        await invoke(cloudEvent({
            status: 'queued',
            userId: 'user-42',
            prompt: 'a cat',
            orgId: 'org-9',
            costReservationId: 'res-1',
        }, 'job-xyz'));

        expect(mocks.generateVideoDirect).toHaveBeenCalledTimes(1);
        expect(mocks.generateVideoDirect).toHaveBeenCalledWith(expect.objectContaining({
            jobId: 'job-xyz',        // from event.params, not the document body
            userId: 'user-42',
            orgId: 'org-9',
            prompt: 'a cat',
            costReservationId: 'res-1',
        }));
    });

    it('defaults orgId to "personal" when the document omits it', async () => {
        await invoke(cloudEvent({ status: 'queued', userId: 'u1', prompt: 'p' }));
        expect(mocks.generateVideoDirect).toHaveBeenCalledWith(
            expect.objectContaining({ orgId: 'personal' }),
        );
    });
});
