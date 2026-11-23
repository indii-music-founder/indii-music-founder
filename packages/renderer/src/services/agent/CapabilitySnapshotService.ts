import {
    CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
    CapabilitySnapshotSchema,
    type CapabilitySnapshot,
} from '@shared/schemas/capabilitySnapshot';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '@/services/firebase';

const CLIENT_FAILURE_TTL_MS = 30_000;

export function createFailClosedCapabilitySnapshot(now = Date.now()): CapabilitySnapshot {
    const expiresAt = now + CLIENT_FAILURE_TTL_MS;
    const unverified = { status: 'unverified' as const, observedAt: now, expiresAt };
    return {
        schemaVersion: CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
        observedAt: now,
        expiresAt,
        capabilities: {
            specialist_routing: { ...unverified },
            image_generation: { ...unverified },
            video_generation: { ...unverified },
            durable_workspace: { ...unverified },
            durable_memory: { ...unverified },
            calendar_connection: { ...unverified },
            calendar_actions: { ...unverified, approvalRequired: true },
            social_connection: { ...unverified },
            social_publishing: { ...unverified, approvalRequired: true },
        },
    };
}

export function parseFreshCapabilitySnapshot(
    value: unknown,
    now = Date.now(),
): CapabilitySnapshot {
    const parsed = CapabilitySnapshotSchema.safeParse(value);
    if (!parsed.success) return createFailClosedCapabilitySnapshot(now);

    const snapshot = parsed.data;
    const entries = Object.values(snapshot.capabilities);
    const isFresh = snapshot.observedAt <= now
        && snapshot.expiresAt > now
        && entries.every(entry => entry.observedAt <= now && entry.expiresAt > now);
    return isFresh ? snapshot : createFailClosedCapabilitySnapshot(now);
}

function isFailClosed(snapshot: CapabilitySnapshot): boolean {
    return Object.values(snapshot.capabilities).every(entry => entry.status !== 'available');
}

// ISSUE-1658: every Boardroom seat fetched this callable before running (up to
// 20 s each, 3-9 seats per send). Reuse a fresh server snapshot until its own
// `expiresAt` and share one request between seats; never cache a fail-closed
// result, so a transient failure is retried on the next call.
let cached: { uid: string | null; snapshot: CapabilitySnapshot } | undefined;
let inFlight: { uid: string | null; promise: Promise<CapabilitySnapshot> } | undefined;

/** Test hook: forget the cached snapshot. */
export function resetCapabilitySnapshotCache(): void {
    cached = undefined;
    inFlight = undefined;
}

async function fetchCapabilitySnapshot(): Promise<CapabilitySnapshot> {
    try {
        const callable = httpsCallable<Record<string, never>, unknown>(
            functions,
            'getCapabilitySnapshot',
            { timeout: 20_000 },
        );
        const response = await callable({});
        return parseFreshCapabilitySnapshot(response.data, Date.now());
    } catch {
        return createFailClosedCapabilitySnapshot(Date.now());
    }
}

export async function loadCapabilitySnapshot(): Promise<CapabilitySnapshot> {
    const uid = auth?.currentUser?.uid ?? null;
    const now = Date.now();
    if (cached && cached.uid === uid && cached.snapshot.expiresAt > now) {
        const stillFresh = parseFreshCapabilitySnapshot(cached.snapshot, now);
        if (!isFailClosed(stillFresh)) return stillFresh;
    }
    if (inFlight && inFlight.uid === uid) return inFlight.promise;
    const promise = fetchCapabilitySnapshot().then(snapshot => {
        if (!isFailClosed(snapshot)) cached = { uid, snapshot };
        return snapshot;
    }).finally(() => {
        if (inFlight?.promise === promise) inFlight = undefined;
    });
    inFlight = { uid, promise };
    return promise;
}
