import {
    CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
    CapabilitySnapshotSchema,
    type CapabilitySnapshot,
} from '@shared/schemas/capabilitySnapshot';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/services/firebase';

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

export async function loadCapabilitySnapshot(): Promise<CapabilitySnapshot> {
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
