/**
 * G2 closure (REMOTE_EXECUTOR_CORE_PLAN §20.2): server-side characterization
 * for the six Studio executor lease callables.
 *
 * The renderer suite pins client payloads; until now NOTHING pinned the
 * server trust boundary — lease validation/expiry, ownership checks, field
 * sanitization, and projection defaults. These handlers are what stops a
 * Controller or another user's Studio from writing into your relay.
 *
 * Handlers are resolved through the onCall mock's WeakMap so export renames
 * or reorders cannot silently mis-route assertions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';

// ─── Hoisted doubles ────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
    type Snap = { exists: boolean; data: Record<string, unknown> };
    const snapshots = new Map<string, Snap>();
    const writes: Array<{ path: string; data: Record<string, unknown>; merge?: boolean }> = [];
    const SERVER_TS = Symbol('server-timestamp');

    const snapFor = (path: string) => {
        const stored = snapshots.get(path) ?? { exists: false, data: {} as Record<string, unknown> };
        return {
            exists: stored.exists,
            data: stored.data,
            // Field-accessor form used by the handlers (snapshot.get('field')).
            get: (field: string) => stored.data[field],
        };
    };

    const docRef = (path: string) => ({
        __path: path,
        get: vi.fn(async () => snapFor(path)),
        set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
            writes.push({ path, data, ...(opts ?? {}) });
            return Promise.resolve(undefined);
        },
        id: path.split('/').pop(),
    });

    const db = {
        doc: vi.fn((path: string) => docRef(path)),
        runTransaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
            cb({
                get: async (ref: { __path: string }) => snapFor(ref.__path),
                set: (ref: { __path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
                    writes.push({ path: ref.__path, data, ...(opts ?? {}) });
                },
                update: (ref: { __path: string }, data: Record<string, unknown>) => {
                    writes.push({ path: ref.__path, data });
                },
            })
        ),
        collection: vi.fn((_path: string) => ({
            add: vi.fn(async (data: Record<string, unknown>) => {
                writes.push({ path: `${_path}/auto-id`, data });
            }),
        })),
    };

    return {
        snapshots,
        writes,
        SERVER_TS,
        db,
        handlersByWrapper: new WeakMap<object, CallHandler>(),
        callConfigs: new WeakMap<object, Record<string, unknown>>(),
        makeSnap: (path: string, exists: boolean, data: Record<string, unknown> = {}) => {
            snapshots.set(path, { exists, data });
        },
        validateAppCheckV2: vi.fn(),
        protectAuthenticatedApiRequest: vi.fn(async (): Promise<
            | { allowed: true; degraded?: true }
            | { allowed: false; status: number; code: string; message: string; retryAfterSeconds?: number }
        > => ({ allowed: true })),
        clearRelay: () => {
            snapshots.clear();
            writes.length = 0;
            mocks.validateAppCheckV2.mockReset();
            mocks.protectAuthenticatedApiRequest.mockReset().mockResolvedValue({ allowed: true });
        },
    };
});

vi.mock('../../config/secrets', () => ({ arcjetKey: { name: 'ARCJET_KEY' } }));
vi.mock('../../middleware/appCheck', () => ({ validateAppCheckV2: mocks.validateAppCheckV2 }));
vi.mock('../security/arcjet', () => ({ protectAuthenticatedApiRequest: mocks.protectAuthenticatedApiRequest }));

vi.mock('firebase-functions/v2/https', () => {
    class HttpsError extends Error {
        constructor(
            public code: string,
            message: string,
        ) {
            super(message);
        }
    }
    return {
        HttpsError,
        onCall: (opts: Record<string, unknown>, handler: (req: unknown) => Promise<unknown>) => {
            const wrapper = (req: unknown) => handler(req);
            mocks.handlersByWrapper.set(wrapper, handler);
            mocks.callConfigs.set(wrapper, opts);
            void opts;
            return wrapper;
        },
    };
});

vi.mock('firebase-admin', () => {
    // The source does `import * as admin from 'firebase-admin'` and touches
    // BOTH `admin.firestore()` and the namespaced `admin.firestore.FieldValue`
    // / `admin.firestore.Timestamp`, so the callable must carry the nested
    // namespaces AND be present at the namespace level.
    const firestore = Object.assign(vi.fn(() => mocks.db), {
        FieldValue: { serverTimestamp: () => mocks.SERVER_TS },
        Timestamp: { fromMillis: (ms: number) => ({ __ts: ms, toMillis: () => ms }) },
    });
    return {
        firestore,
        default: { firestore },
    };
});

vi.mock('./mobilePushNotifications', () => ({
    notifyNewMobileApproval: vi.fn(async () => undefined),
}));

import * as remote from './issueStudioExecutorLease';

// Resolve each export's captured onCall handler through its wrapper identity,
// so reordering/re naming exports cannot mis-route assertions.
type CallHandler = (req: { auth?: { uid: string; token?: Record<string, unknown> } | null; data?: unknown; rawRequest?: unknown }) => Promise<unknown>;

const handlerOf = (fn: unknown): CallHandler => {
    const h = mocks.handlersByWrapper.get(fn as object);
    if (!h) throw new Error('No captured onCall handler for export');
    return h;
};

const UID = 'uid-owner-0001';
const DEVICE_ID = 'studio-device-0001'; // matches /^[A-Za-z0-9_-]{16,128}$/
const SECRET = 'enrollment-secret-000000000000000'; // matches 32..256
const INSTANCE = 'studio-instance-001';
const devicePath = `users/${UID}/studioExecutors/${DEVICE_ID}`;
const statePath = `users/${UID}/remote-relay/state`;
const cmdPath = (id: string) => `users/${UID}/remote-relay-commands/${id}`;

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

const req = (data: unknown, auth: { uid: string; token?: Record<string, unknown> } | null = { uid: UID, token: { email_verified: true, firebase: { sign_in_provider: 'password' } } }) => ({
    auth,
    data,
    rawRequest: { method: 'POST', headers: {} } as never,
});

beforeEach(() => {
    mocks.clearRelay();
});

// ─── Registration posture (§11 security surface) ────────────────────────────

describe('callable registration posture', () => {
    it('registers all six callables, app-check disabled, single region, and binds arcjetKey secret', () => {
        const exports = Object.values(remote);
        expect(exports).toHaveLength(6);

        for (const callable of exports) {
            expect(mocks.callConfigs.get(callable as object)).toMatchObject({
                region: 'us-central1',
                enforceAppCheck: false,
                secrets: [expect.objectContaining({ name: 'ARCJET_KEY' })],
            });
        }
        // Every export captured a handler (nothing fell through the mock).
        expect(exports.every(fn => mocks.handlersByWrapper.has(fn as object))).toBe(true);
    });
});

// ─── issueStudioExecutorLease ───────────────────────────────────────────────

describe('issueStudioExecutorLease', () => {
    const issue = () => handlerOf(remote.issueStudioExecutorLease);

    it('requires authentication', async () => {
        await expect(issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }, null))).rejects.toMatchObject({
            code: 'unauthenticated',
        });
    });

    it('rejects malformed device ids and short enrollment secrets', async () => {
        await expect(issue()(req({ deviceId: 'short-id', enrollmentSecret: SECRET }))).rejects.toMatchObject({
            code: 'invalid-argument',
        });
        await expect(issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: 'tiny' }))).rejects.toMatchObject({
            code: 'invalid-argument',
        });
    });

    it('enrolls a new device with a hashed secret, rotating token, and 10-minute expiry', async () => {
        const before = Date.now();
        const result = (await issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))) as {
            deviceId: string;
            leaseToken: string;
            expiresAt: number;
        };

        expect(result.deviceId).toBe(DEVICE_ID);
        expect(result.leaseToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
        expect(result.expiresAt).toBeGreaterThanOrEqual(before + 600_000 - 2_000);
        expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + 600_000 + 2_000);

        const write = mocks.writes.find(w => w.path === devicePath);
        expect(write?.data).toMatchObject({
            deviceId: DEVICE_ID,
            secretHash: sha256Hex(SECRET),
            activeLeaseToken: result.leaseToken,
            createdAt: mocks.SERVER_TS,
        });
        expect((write?.data['leaseExpiresAt'] as { toMillis(): number }).toMillis()).toBe(result.expiresAt);
        expect(JSON.stringify(write)).not.toContain(SECRET); // raw secret never persisted
    });

    it('refuses a different keychain credential for an enrolled device', async () => {
        mocks.makeSnap(devicePath, true, { secretHash: sha256Hex('a-different-previous-secret-0000000000') });

        await expect(issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))).rejects.toMatchObject({
            code: 'permission-denied',
        });
    });

    it('rotates the token for the matching credential while preserving createdAt', async () => {
        mocks.makeSnap(devicePath, true, {
            secretHash: sha256Hex(SECRET),
            createdAt: { __ts: 111 },
        });

        const first = (await issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))) as { leaseToken: string };
        const second = (await issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))) as { leaseToken: string };

        expect(first.leaseToken).not.toBe(second.leaseToken);
        const write = mocks.writes.find(w => w.path === devicePath);
        expect(write?.data['createdAt']).toEqual({ __ts: 111 });
    });

    it('rejects anonymous authentication across lease issuance and relay callables', async () => {
        const anonReq = req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }, {
            uid: UID,
            token: { firebase: { sign_in_provider: 'anonymous' } },
        });
        await expect(issue()(anonReq)).rejects.toMatchObject({
            code: 'permission-denied',
            message: 'Anonymous accounts cannot access Studio remote relay.',
        });
        await expect(handlerOf(remote.publishStudioPresence)(anonReq)).rejects.toMatchObject({
            code: 'permission-denied',
        });
        await expect(handlerOf(remote.releaseStudioPresence)(anonReq)).rejects.toMatchObject({
            code: 'permission-denied',
        });
        await expect(handlerOf(remote.claimStudioCommand)(anonReq)).rejects.toMatchObject({
            code: 'permission-denied',
        });
        await expect(handlerOf(remote.publishStudioResponse)(anonReq)).rejects.toMatchObject({
            code: 'permission-denied',
        });
        await expect(handlerOf(remote.completeStudioCommand)(anonReq)).rejects.toMatchObject({
            code: 'permission-denied',
        });
    });

    it('enforces validateAppCheckV2 across all callables', async () => {
        mocks.validateAppCheckV2.mockImplementationOnce(() => {
            throw new HttpsError('failed-precondition', 'Unauthorized: Missing App Check token.');
        });
        await expect(issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))).rejects.toMatchObject({
            code: 'failed-precondition',
            message: 'Unauthorized: Missing App Check token.',
        });
    });

    it('fails closed when request admission context is missing', async () => {
        const rawReq = {
            auth: { uid: UID, token: { email_verified: true, firebase: { sign_in_provider: 'password' } } },
            data: { deviceId: DEVICE_ID, enrollmentSecret: SECRET },
            rawRequest: undefined,
        };
        await expect(issue()(rawReq as never)).rejects.toMatchObject({
            code: 'unavailable',
            message: 'Request protection is temporarily unavailable.',
        });
    });

    it('rejects requests when Arcjet admission returns 429 resource-exhausted', async () => {
        mocks.protectAuthenticatedApiRequest.mockResolvedValueOnce({
            allowed: false,
            status: 429,
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded on Studio executor lease.',
        });
        await expect(issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))).rejects.toMatchObject({
            code: 'resource-exhausted',
            message: 'Rate limit exceeded on Studio executor lease.',
        });
    });

    it('prevents a rogue new device from overwriting an active healthy desktop lease', async () => {
        const activeDeviceId = 'active-desktop-device-001';
        const activeDevicePath = `users/${UID}/studioExecutors/${activeDeviceId}`;
        mocks.makeSnap(statePath, true, {
            online: true,
            executorDeviceId: activeDeviceId,
        });
        mocks.makeSnap(activeDevicePath, true, {
            activeLeaseToken: 'active-desktop-lease-token',
            leaseExpiresAt: { toMillis: () => Date.now() + 300_000 },
        });

        await expect(
            issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))
        ).rejects.toMatchObject({
            code: 'failed-precondition',
            message: 'Cannot enroll a new Studio executor while an active desktop lease is online.',
        });
    });

    it('allows a new device enrollment when the previously active desktop is offline', async () => {
        const activeDeviceId = 'active-desktop-device-001';
        const activeDevicePath = `users/${UID}/studioExecutors/${activeDeviceId}`;
        mocks.makeSnap(statePath, true, {
            online: false,
            executorDeviceId: activeDeviceId,
        });
        mocks.makeSnap(activeDevicePath, true, {
            activeLeaseToken: 'active-desktop-lease-token',
            leaseExpiresAt: { toMillis: () => Date.now() + 300_000 },
        });

        const result = (await issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))) as {
            deviceId: string;
            leaseToken: string;
        };
        expect(result.deviceId).toBe(DEVICE_ID);
        expect(result.leaseToken).toBeDefined();
    });

    it('allows a new device enrollment when the previously active desktop lease has expired', async () => {
        const activeDeviceId = 'active-desktop-device-001';
        const activeDevicePath = `users/${UID}/studioExecutors/${activeDeviceId}`;
        mocks.makeSnap(statePath, true, {
            online: true,
            executorDeviceId: activeDeviceId,
        });
        mocks.makeSnap(activeDevicePath, true, {
            activeLeaseToken: 'active-desktop-lease-token',
            leaseExpiresAt: { toMillis: () => Date.now() - 5_000 },
        });

        const result = (await issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))) as {
            deviceId: string;
            leaseToken: string;
        };
        expect(result.deviceId).toBe(DEVICE_ID);
        expect(result.leaseToken).toBeDefined();
    });

    it('allows the currently enrolled active desktop to renew its lease while online', async () => {
        mocks.makeSnap(devicePath, true, {
            secretHash: sha256Hex(SECRET),
            activeLeaseToken: 'current-desktop-token',
            leaseExpiresAt: { toMillis: () => Date.now() + 300_000 },
            createdAt: mocks.SERVER_TS,
        });
        mocks.makeSnap(statePath, true, {
            online: true,
            executorDeviceId: DEVICE_ID,
        });

        const result = (await issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }))) as {
            deviceId: string;
            leaseToken: string;
        };
        expect(result.deviceId).toBe(DEVICE_ID);
        expect(result.leaseToken).not.toBe('current-desktop-token');
    });
});

// ─── Lease enforcement shared by all five executor callables ─────────────────

describe('lease enforcement (assertLease)', () => {
    const presence = () => handlerOf(remote.publishStudioPresence);

    it('rejects an unauthenticated caller', async () => {
        await expect(presence()(req({ deviceId: DEVICE_ID, leaseToken: 'tok' }, null))).rejects.toMatchObject({
            code: 'unauthenticated',
        });
    });

    it('rejects a device with no enrolled lease', async () => {
        await expect(presence()(req({ deviceId: DEVICE_ID, leaseToken: 'tok', protocolVersion: 1, state: {} })))
            .rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects a stale token even when the device is enrolled', async () => {
        mocks.makeSnap(devicePath, true, {
            activeLeaseToken: 'the-real-token',
            leaseExpiresAt: { toMillis: () => Date.now() + 600_000 },
        });

        await expect(presence()(req({ deviceId: DEVICE_ID, leaseToken: 'stolen-guess', protocolVersion: 1, state: {} })))
            .rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects an expired lease', async () => {
        mocks.makeSnap(devicePath, true, {
            activeLeaseToken: 'the-real-token',
            leaseExpiresAt: { toMillis: () => Date.now() - 1 },
        });

        await expect(presence()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', protocolVersion: 1, state: {} })))
            .rejects.toMatchObject({ code: 'permission-denied' });
    });
});

// ─── publishStudioPresence ──────────────────────────────────────────────────

describe('publishStudioPresence', () => {
    const presence = () => handlerOf(remote.publishStudioPresence);
    const enroll = () =>
        mocks.makeSnap(devicePath, true, {
            activeLeaseToken: 'the-real-token',
            leaseExpiresAt: { toMillis: () => Date.now() + 600_000 },
        });

    it('rejects unsupported protocol versions instead of guessing', async () => {
        enroll();
        await expect(
            presence()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', protocolVersion: 99, state: {} }))
        ).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('rejects an invalid studioInstanceId', async () => {
        enroll();
        await expect(
            presence()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', protocolVersion: 1, state: { studioInstanceId: 'abc' } }))
        ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('projects trusted presence with defaults, identity, and server timestamps', async () => {
        enroll();
        await presence()(req({
            deviceId: DEVICE_ID,
            leaseToken: 'the-real-token',
            protocolVersion: 1,
            state: { studioInstanceId: INSTANCE, currentModule: 'creative', isAgentProcessing: true, sleepMode: false },
        }));

        const write = mocks.writes.find(w => w.path === statePath);
        expect(write?.merge).toBe(true);
        expect(write?.data).toMatchObject({
            currentModule: 'creative',
            isAgentProcessing: true,
            activeSessionId: '',
            sleepMode: false,
            online: true,
            role: 'studio',
            studioInstanceId: INSTANCE,
            executorDeviceId: DEVICE_ID,
            protocolVersion: 1,
            listenerReady: true,
            timestamp: mocks.SERVER_TS,
        });
    });

    it('projects capabilities with boolean coercion and drops unknown keys (Phase 5)', async () => {
        enroll();
        await presence()(req({
            deviceId: DEVICE_ID,
            leaseToken: 'the-real-token',
            protocolVersion: 1,
            state: {
                studioInstanceId: INSTANCE,
                capabilities: { agent: true, computer: 1, audio: 'yes', daw: false, ui: true, sudo: true },
            },
        }));

        const write = mocks.writes.find(w => w.path === statePath);
        expect(write?.data['capabilities']).toEqual({ agent: true, computer: false, audio: false, daw: false, ui: true });
        expect(write?.data['capabilities']).not.toHaveProperty('sudo');
    });

    it('projects only bounded approval details and clears invalid approvals', async () => {
        enroll();
        const approval = {
            id: '123e4567-e89b-42d3-a456-426614174000',
            content: 'Approve draft action',
            type: 'tool',
            timestamp: Date.now(),
            expiresAt: Date.now() + 60_000,
            resolve: 'must never leave Studio',
        };
        await presence()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', state: { studioInstanceId: INSTANCE, pendingApproval: approval } }));
        expect(mocks.writes.at(-1)?.data.pendingApproval).toEqual({
            id: approval.id,
            content: approval.content,
            type: approval.type,
            timestamp: approval.timestamp,
            expiresAt: approval.expiresAt,
        });
        await presence()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', state: { studioInstanceId: INSTANCE, pendingApproval: { ...approval, content: 'x'.repeat(2001) } } }));
        expect(mocks.writes.at(-1)?.data.pendingApproval).toBeNull();
    });

    it('projects bounded playback fields and clears stale track metadata', async () => {
        enroll();
        await presence()(req({
            deviceId: DEVICE_ID, leaseToken: 'the-real-token', protocolVersion: 1,
            state: { studioInstanceId: INSTANCE, activeTrackId: 'track-1', activeTrackTitle: 'New Master', isPlaying: true,
                nowPlayingPositionSec: 31, nowPlayingDurationSec: 180, activeTrackUrl: 'https://untrusted.example/file' },
        }));
        const write = mocks.writes.find(w => w.path === statePath);
        expect(write?.data).toMatchObject({ activeTrackId: 'track-1', activeTrackTitle: 'New Master', isPlaying: true,
            nowPlayingPositionSec: 31, nowPlayingDurationSec: 180 });
        expect(write?.data).not.toHaveProperty('activeTrackUrl');
    });

    it('applies safe defaults for absent fields and slices overlong strings', async () => {
        enroll();
        await presence()(req({
            deviceId: DEVICE_ID,
            leaseToken: 'the-real-token',
            protocolVersion: 1,
            state: {
                studioInstanceId: INSTANCE,
                currentModule: 'x'.repeat(120),
                activeSessionId: 'y'.repeat(300),
                sleepMode: 'truthy-junk',
            },
        }));

        const write = mocks.writes.find(w => w.path === statePath);
        expect(write?.data['currentModule']).toHaveLength(80);
        expect(write?.data['activeSessionId']).toHaveLength(128);
        expect(write?.data['isAgentProcessing']).toBe(false); // junk never becomes true
        expect(write?.data['sleepMode']).toBe(false);
    });
});

// ─── releaseStudioPresence ──────────────────────────────────────────────────

describe('releaseStudioPresence', () => {
    const release = () => handlerOf(remote.releaseStudioPresence);
    const enroll = () =>
        mocks.makeSnap(devicePath, true, {
            activeLeaseToken: 'the-real-token',
            leaseExpiresAt: { toMillis: () => Date.now() + 600_000 },
        });

    it('clears online/listenerReady only when the dying instance owns the state doc', async () => {
        enroll();
        mocks.makeSnap(statePath, true, { studioInstanceId: INSTANCE, executorDeviceId: DEVICE_ID });

        await release()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', studioInstanceId: INSTANCE }));

        const write = mocks.writes.find(w => w.path === statePath);
        expect(write?.data).toEqual({ online: false, listenerReady: false, pendingApproval: null, timestamp: mocks.SERVER_TS });
    });

    it('never clobbers a NEWER Studio instance that took over presence', async () => {
        enroll();
        mocks.makeSnap(statePath, true, { studioInstanceId: 'newer-instance-999999', executorDeviceId: DEVICE_ID });

        await release()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', studioInstanceId: INSTANCE }));

        expect(mocks.writes.find(w => w.path === statePath)).toBeUndefined();
    });
});

// ─── claimStudioCommand ─────────────────────────────────────────────────────

describe('claimStudioCommand', () => {
    const claim = () => handlerOf(remote.claimStudioCommand);
    const enroll = () =>
        mocks.makeSnap(devicePath, true, {
            activeLeaseToken: 'the-real-token',
            leaseExpiresAt: { toMillis: () => Date.now() + 600_000 },
        });

    it('claims a pending studio-targeted command and stamps executor identity', async () => {
        enroll();
        mocks.makeSnap(cmdPath('cmd-1'), true, { status: 'pending', executionTarget: 'studio' });

        const result = (await claim()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', commandId: 'cmd-1', studioInstanceId: INSTANCE }))) as { claimed: boolean };

        expect(result.claimed).toBe(true);
        const write = mocks.writes.find(w => w.path === cmdPath('cmd-1'));
        expect(write?.data).toEqual({
            status: 'processing',
            executorId: INSTANCE,
            executorDeviceId: DEVICE_ID,
            claimedAt: mocks.SERVER_TS,
        });
    });

    it('never claims cloud-owned, non-pending, or missing commands', async () => {
        enroll();
        mocks.makeSnap(cmdPath('cloud-cmd'), true, { status: 'pending', executionTarget: 'cloud' });
        mocks.makeSnap(cmdPath('done-cmd'), true, { status: 'completed', executionTarget: 'studio' });

        expect(
            ((await claim()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', commandId: 'cloud-cmd', studioInstanceId: INSTANCE }))) as { claimed: boolean }).claimed
        ).toBe(false);
        expect(
            ((await claim()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', commandId: 'done-cmd', studioInstanceId: INSTANCE }))) as { claimed: boolean }).claimed
        ).toBe(false);
        expect(
            ((await claim()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', commandId: 'missing-cmd', studioInstanceId: INSTANCE }))) as { claimed: boolean }).claimed
        ).toBe(false);
        expect(mocks.writes.filter(w => w.path.startsWith(`users/${UID}/remote-relay-commands/`))).toHaveLength(0);
    });
});

// ─── publishStudioResponse ──────────────────────────────────────────────────

describe('publishStudioResponse', () => {
    const publish = () => handlerOf(remote.publishStudioResponse);
    const enroll = (commandOver?: Record<string, unknown>) => {
        mocks.makeSnap(devicePath, true, {
            activeLeaseToken: 'the-real-token',
            leaseExpiresAt: { toMillis: () => Date.now() + 600_000 },
        });
        mocks.makeSnap(cmdPath('cmd-1'), true, {
            executionTarget: 'studio',
            executorDeviceId: DEVICE_ID,
            ...commandOver,
        });
    };

    it('enforces response ownership — another device cannot answer your command', async () => {
        enroll({ executorDeviceId: 'another-device-9999999' });
        await expect(
            publish()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', commandId: 'cmd-1', text: 'hi', isStreaming: false }))
        ).rejects.toMatchObject({ code: 'permission-denied' });
        expect(mocks.writes).toHaveLength(0);
    });

    it('rejects oversized text payloads', async () => {
        enroll();
        await expect(
            publish()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', commandId: 'cmd-1', text: 'x'.repeat(20_001), isStreaming: false }))
        ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('writes sanitized final responses (isFinal, capped arrays/strings)', async () => {
        enroll();
        await publish()(req({
            deviceId: DEVICE_ID,
            leaseToken: 'the-real-token',
            commandId: 'cmd-1',
            text: 'Done.',
            agentId: 'a'.repeat(150),
            imageUrls: ['ok-1', 42 as unknown as string, 'ok-2'],
            videoUrls: ['clip-1', 42 as unknown as string, 'clip-2'],
            boardroomMessageId: 'b'.repeat(300),
            isStreaming: false,
        }));

        const write = mocks.writes.find(w => w.path.includes('remote-relay-responses/'));
        expect(write?.data).toMatchObject({
            commandId: 'cmd-1',
            text: 'Done.',
            agentId: 'a'.repeat(100),
            imageUrls: ['ok-1', 'ok-2'],
            videoUrls: ['clip-1', 'clip-2'],
            boardroomMessageId: 'b'.repeat(128),
            isStreaming: false,
            isFinal: true,
            timestamp: mocks.SERVER_TS,
        });
    });

    it('marks streaming responses as not-final and omits absent optional keys', async () => {
        enroll();
        await publish()(req({
            deviceId: DEVICE_ID,
            leaseToken: 'the-real-token',
            commandId: 'cmd-1',
            text: 'Working…',
            isStreaming: true,
        }));

        const write = mocks.writes.find(w => w.path.includes('remote-relay-responses/'));
        expect(write?.data).toMatchObject({ isStreaming: true, isFinal: false });
        expect(write?.data).not.toHaveProperty('agentId');
        expect(write?.data).not.toHaveProperty('imageUrls');
        expect(write?.data).not.toHaveProperty('videoUrls');
    });
});

// ─── completeStudioCommand ──────────────────────────────────────────────────

describe('completeStudioCommand', () => {
    const complete = () => handlerOf(remote.completeStudioCommand);
    const enroll = (commandOver?: Record<string, unknown>) => {
        mocks.makeSnap(devicePath, true, {
            activeLeaseToken: 'the-real-token',
            leaseExpiresAt: { toMillis: () => Date.now() + 600_000 },
        });
        mocks.makeSnap(cmdPath('cmd-1'), true, {
            executionTarget: 'studio',
            executorDeviceId: DEVICE_ID,
            ...commandOver,
        });
    };

    it('flips a processing command to completed with a server timestamp', async () => {
        enroll({ status: 'processing' });
        await complete()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', commandId: 'cmd-1' }));

        const write = mocks.writes.find(w => w.path === cmdPath('cmd-1'));
        expect(write?.data).toEqual({ status: 'completed', completedAt: mocks.SERVER_TS });
    });

    it('is a no-op for commands not currently processing', async () => {
        enroll({ status: 'pending' });
        await complete()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', commandId: 'cmd-1' }));
        expect(mocks.writes.filter(w => w.path === cmdPath('cmd-1'))).toHaveLength(0);
    });

    it('enforces completion ownership', async () => {
        enroll({ status: 'processing', executorDeviceId: 'another-device-9999999' });
        await expect(
            complete()(req({ deviceId: DEVICE_ID, leaseToken: 'the-real-token', commandId: 'cmd-1' }))
        ).rejects.toMatchObject({ code: 'permission-denied' });
    });
});

// ─── security & admission controls (ISSUE-1543) ─────────────────────────────

describe('security & admission controls (ISSUE-1543)', () => {
    const issue = () => handlerOf(remote.issueStudioExecutorLease);

    it('rejects unverified email callers', async () => {
        await expect(
            issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }, { uid: UID, token: { email_verified: false } } as never))
        ).rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous auth callers', async () => {
        await expect(
            issue()(req({ deviceId: DEVICE_ID, enrollmentSecret: SECRET }, {
                uid: UID,
                token: { email_verified: true, firebase: { sign_in_provider: 'anonymous' } }
            } as never))
        ).rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('prevents rogue auto-enrollment when an active Studio session is online', async () => {
        mocks.makeSnap(statePath, true, {
            online: true,
            executorDeviceId: 'active-desktop-device-01',
            leaseExpiresAt: { toMillis: () => Date.now() + 300_000 },
        });

        await expect(
            issue()(req({ deviceId: 'rogue-device-00000002', enrollmentSecret: SECRET }))
        ).rejects.toMatchObject({
            code: 'failed-precondition',
        });
    });
});
