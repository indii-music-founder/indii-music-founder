import type { CapabilitySnapshot } from '@shared/schemas/capabilitySnapshot';
import { describe, expect, it } from 'vitest';

import {
    createFailClosedCapabilitySnapshot,
    parseFreshCapabilitySnapshot,
} from './CapabilitySnapshotService';

const NOW = Date.parse('2026-07-30T12:00:00.000Z');

function availableSnapshot(): CapabilitySnapshot {
    const expiresAt = NOW + 60_000;
    const available = { status: 'available' as const, observedAt: NOW, expiresAt };
    return {
        schemaVersion: 'capability-snapshot.v1',
        observedAt: NOW,
        expiresAt,
        capabilities: {
            specialist_routing: { ...available },
            image_generation: { ...available },
            video_generation: { ...available },
            durable_workspace: { ...available },
            durable_memory: { ...available },
            calendar_connection: { ...available },
            calendar_actions: { ...available, approvalRequired: true },
            social_connection: { ...available },
            social_publishing: { ...available, approvalRequired: true },
        },
    };
}

describe('CapabilitySnapshotService', () => {
    it('accepts a complete fresh versioned snapshot', () => {
        const fresh = availableSnapshot();
        expect(parseFreshCapabilitySnapshot(fresh, NOW)).toEqual(fresh);
    });

    it('fails closed when the snapshot is stale', () => {
        const stale = availableSnapshot();
        const parsed = parseFreshCapabilitySnapshot(stale, stale.expiresAt);

        expect(Object.values(parsed.capabilities).every(
            capability => capability.status === 'unverified',
        )).toBe(true);
    });

    it('fails closed when any capability is missing, malformed, expired, or observed in the future', () => {
        const missing = availableSnapshot() as unknown as Record<string, unknown>;
        delete (missing.capabilities as Record<string, unknown>).image_generation;
        const malformed = { ...availableSnapshot(), schemaVersion: 'capability-snapshot.v2' };
        const future = availableSnapshot();
        future.capabilities.image_generation.observedAt = NOW + 1;

        for (const value of [missing, malformed, future]) {
            const parsed = parseFreshCapabilitySnapshot(value, NOW);
            expect(parsed.capabilities.image_generation.status).toBe('unverified');
            expect(parsed.capabilities.specialist_routing.status).toBe('unverified');
        }
    });

    it('creates a complete short-lived transport-failure snapshot', () => {
        const failed = createFailClosedCapabilitySnapshot(NOW);

        expect(failed.schemaVersion).toBe('capability-snapshot.v1');
        expect(failed.expiresAt).toBeGreaterThan(NOW);
        expect(Object.values(failed.capabilities).every(
            capability => capability.status === 'unverified',
        )).toBe(true);
        expect(failed.capabilities.social_publishing.approvalRequired).toBe(true);
    });
});
