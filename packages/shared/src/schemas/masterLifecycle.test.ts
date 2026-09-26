import { describe, expect, it } from 'vitest';
import {
    MASTER_ADMIN_STATE_SCHEMA_VERSION,
    MASTER_LIFECYCLE_EDGES,
    MasterAdminStateSchema,
    MasterLifecycleStatusSchema,
    assertMasterLifecycleTransition,
    canTransitionMasterLifecycle,
} from './masterLifecycle.js';

const NOW = new Date('2026-09-26T12:00:00.000Z').toISOString();

function transition(from: string, to: string, at = NOW) {
    return { from, to, at, actor: 'runbook' as const };
}

/** Walk the happy-path spine from DRAFT. */
function spineHistory(): ReturnType<typeof transition>[] {
    return [
        transition('DRAFT', 'INGESTED'),
        transition('INGESTED', 'METADATA_AUDITED'),
        transition('METADATA_AUDITED', 'SPLITS_PENDING'),
        transition('SPLITS_PENDING', 'ADMIN_LOCKED'),
    ];
}

function validState(overrides: Record<string, unknown> = {}) {
    return {
        id: 'a'.repeat(40),
        userId: 'user-1',
        schemaVersion: MASTER_ADMIN_STATE_SCHEMA_VERSION,
        masterHash: 'a'.repeat(40),
        storagePath: 'users/user-1/masters/' + 'a'.repeat(40) + '/original.wav',
        generation: '17273000000000000',
        lifecycle: 'ADMIN_LOCKED',
        enteredAt: NOW,
        history: spineHistory(),
        openTaskIds: [],
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}

describe('masterLifecycle FSM', () => {
    it('exposes the six mission spine statuses plus the two exception states', () => {
        const statuses = MasterLifecycleStatusSchema.options;
        expect(statuses).toContain('DRAFT');
        expect(statuses).toContain('INGESTED');
        expect(statuses).toContain('METADATA_AUDITED');
        expect(statuses).toContain('SPLITS_PENDING');
        expect(statuses).toContain('ADMIN_LOCKED');
        expect(statuses).toContain('DISTRIBUTION_READY');
        expect(statuses).toHaveLength(8); // + ADMIN_BLOCKED, TAKEN_DOWN
    });

    it('spine edges are exactly the mission contract', () => {
        expect(MASTER_LIFECYCLE_EDGES.DRAFT).toEqual(['INGESTED']);
        expect(MASTER_LIFECYCLE_EDGES.INGESTED).toEqual(['METADATA_AUDITED', 'ADMIN_BLOCKED']);
        expect(MASTER_LIFECYCLE_EDGES.METADATA_AUDITED).toEqual(['SPLITS_PENDING', 'ADMIN_BLOCKED']);
        expect(MASTER_LIFECYCLE_EDGES.SPLITS_PENDING).toEqual(['ADMIN_LOCKED', 'ADMIN_BLOCKED']);
        expect(MASTER_LIFECYCLE_EDGES.ADMIN_LOCKED).toEqual(['DISTRIBUTION_READY']);
        expect(MASTER_LIFECYCLE_EDGES.DISTRIBUTION_READY).toEqual(['TAKEN_DOWN']);
        expect(MASTER_LIFECYCLE_EDGES.TAKEN_DOWN).toEqual([]);
    });

    it('accepts every spine transition and rejects every shortcut', () => {
        expect(canTransitionMasterLifecycle('DRAFT', 'INGESTED')).toBe(true);
        expect(canTransitionMasterLifecycle('SPLITS_PENDING', 'ADMIN_LOCKED')).toBe(true);
        expect(canTransitionMasterLifecycle('ADMIN_BLOCKED', 'SPLITS_PENDING')).toBe(true);

        // No skipping the audit / splits / lock gates:
        expect(canTransitionMasterLifecycle('DRAFT', 'DISTRIBUTION_READY')).toBe(false);
        expect(canTransitionMasterLifecycle('INGESTED', 'ADMIN_LOCKED')).toBe(false);
        expect(canTransitionMasterLifecycle('METADATA_AUDITED', 'DISTRIBUTION_READY')).toBe(false);
        expect(canTransitionMasterLifecycle('DRAFT', 'ADMIN_LOCKED')).toBe(false);
        // No un-takedown:
        expect(canTransitionMasterLifecycle('TAKEN_DOWN', 'DISTRIBUTION_READY')).toBe(false);
        // ADMIN_LOCKED cannot silently reopen:
        expect(canTransitionMasterLifecycle('ADMIN_LOCKED', 'SPLITS_PENDING')).toBe(false);
    });

    it('assertMasterLifecycleTransition throws with the legal exits on violation', () => {
        expect(() => assertMasterLifecycleTransition('DRAFT', 'ADMIN_LOCKED')).toThrow(/DRAFT → ADMIN_LOCKED/);
        expect(() => assertMasterLifecycleTransition('INGESTED', 'METADATA_AUDITED')).not.toThrow();
    });
});

describe('MasterAdminStateSchema', () => {
    it('accepts a valid spine-locked state', () => {
        const result = MasterAdminStateSchema.safeParse(validState());
        expect(result.success).toBe(true);
    });

    it('rejects a document whose id is not the master hash', () => {
        const result = MasterAdminStateSchema.safeParse(validState({ id: 'b'.repeat(40) }));
        expect(result.success).toBe(false);
    });

    it('rejects a non-DRAFT state with empty history', () => {
        const result = MasterAdminStateSchema.safeParse(validState({ history: [] }));
        expect(result.success).toBe(false);
    });

    it('accepts a DRAFT state with empty history', () => {
        const result = MasterAdminStateSchema.safeParse(validState({
            lifecycle: 'DRAFT',
            history: [],
        }));
        expect(result.success).toBe(true);
    });

    it('rejects a broken history chain (disconnected entries)', () => {
        const history = [
            transition('DRAFT', 'INGESTED'),
            transition('METADATA_AUDITED', 'SPLITS_PENDING'), // jump: INGESTED ≠ METADATA_AUDITED
        ];
        const result = MasterAdminStateSchema.safeParse(validState({
            lifecycle: 'SPLITS_PENDING',
            history,
        }));
        expect(result.success).toBe(false);
    });

    it('rejects history whose end does not match lifecycle', () => {
        const result = MasterAdminStateSchema.safeParse(validState({
            history: [transition('DRAFT', 'INGESTED')],
        })); // lifecycle says ADMIN_LOCKED, history lands on INGESTED
        expect(result.success).toBe(false);
    });

    it('rejects unknown statuses and malformed generations', () => {
        expect(MasterAdminStateSchema.safeParse(validState({ lifecycle: 'PUBLISHED' })).success).toBe(false);
        expect(MasterAdminStateSchema.safeParse(validState({ generation: '1.5' })).success).toBe(false);
        // Generations must stay digit strings — uint64 precision must never ride in a float:
        expect(MasterAdminStateSchema.safeParse(validState({ generation: 17273000000000000 })).success).toBe(false);
    });
});
