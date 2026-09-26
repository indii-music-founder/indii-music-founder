import { describe, expect, it } from 'vitest';
import {
    ADMINISTRATIVE_TASK_SCHEMA_VERSION,
    AdministrativeTaskSchema,
    canonicalAdministrativeTaskRefs,
} from './administrativeTask.js';

const NOW = new Date('2026-09-26T12:00:00.000Z').toISOString();

function openTask(overrides: Record<string, unknown> = {}) {
    return {
        id: 'IDENTIFIER_ISRC_WITHOUT_ISWC_abcdef0123456789abcdef',
        userId: 'user-1',
        schemaVersion: ADMINISTRATIVE_TASK_SCHEMA_VERSION,
        type: 'IDENTIFIER_ISRC_WITHOUT_ISWC',
        severity: 'warning',
        status: 'open',
        entityType: 'master',
        entityRefs: { masterHash: 'a'.repeat(40) },
        findings: [
            { field: 'iswc', expected: 'ISWC present when ISRC is present', observed: 'missing', source: 'identifier-cross-validation.v1' },
        ],
        proposedAction: null,
        jevRef: null,
        dedupeKey: 'IDENTIFIER_ISRC_WITHOUT_ISWC_abcdef0123456789abcdef',
        createdAt: NOW,
        updatedAt: NOW,
        resolvedAt: null,
        ...overrides,
    };
}

describe('AdministrativeTaskSchema', () => {
    it('accepts a valid open task', () => {
        expect(AdministrativeTaskSchema.safeParse(openTask()).success).toBe(true);
    });

    it('accepts an action_ready task whose action is staged and approval-gated', () => {
        const task = openTask({
            status: 'action_ready',
            proposedAction: {
                kind: 'staged_registration_payload',
                payload: { registry: 'CWR', workTitle: 'Song', writers: [] },
                requiresApproval: true,
                builderRef: 'draftCwrRegistration@v1',
            },
        });
        expect(AdministrativeTaskSchema.safeParse(task).success).toBe(true);
    });

    it('REFUSES a proposed action that does not require approval (literal true)', () => {
        const task = openTask({
            status: 'action_ready',
            proposedAction: {
                kind: 'staged_registration_payload',
                payload: {},
                requiresApproval: false,
                builderRef: 'draftCwrRegistration@v1',
            },
        });
        expect(AdministrativeTaskSchema.safeParse(task).success).toBe(false);
    });

    it('requires resolvedAt when executed or dismissed', () => {
        expect(AdministrativeTaskSchema.safeParse(openTask({ status: 'executed' })).success).toBe(false);
        expect(AdministrativeTaskSchema.safeParse(openTask({ status: 'dismissed' })).success).toBe(false);
        expect(AdministrativeTaskSchema.safeParse(openTask({
            status: 'executed',
            resolvedAt: NOW,
        })).success).toBe(true);
    });

    it('requires a proposedAction when status is action_ready', () => {
        expect(AdministrativeTaskSchema.safeParse(openTask({ status: 'action_ready' })).success).toBe(false);
    });

    it('rejects an id that is not the dedupeKey', () => {
        expect(AdministrativeTaskSchema.safeParse(openTask({ id: 'some-other-id-123456' })).success).toBe(false);
    });

    it('rejects unknown types, severities, and statuses', () => {
        expect(AdministrativeTaskSchema.safeParse(openTask({ type: 'MAKE_COFFEE' })).success).toBe(false);
        expect(AdministrativeTaskSchema.safeParse(openTask({ severity: 'meh' })).success).toBe(false);
        expect(AdministrativeTaskSchema.safeParse(openTask({ status: 'auto_executed' })).success).toBe(false);
    });

    it('rejects extra (non-whitelisted) fields — Admin SDK write surface stays narrow', () => {
        expect(AdministrativeTaskSchema.safeParse(openTask({ autoExecute: true })).success).toBe(false);
    });
});

describe('canonicalAdministrativeTaskRefs', () => {
    it('is key-order independent (stable dedupe keys)', () => {
        const a = canonicalAdministrativeTaskRefs({ masterHash: 'a'.repeat(40), releaseId: 'rel-1' });
        const b = canonicalAdministrativeTaskRefs({ releaseId: 'rel-1', masterHash: 'a'.repeat(40) });
        expect(a).toBe(b);
        expect(a).toBe(`masterHash=${'a'.repeat(40)}|releaseId=rel-1`);
    });

    it('omits empty refs so sparse refs hash identically to their minimal form', () => {
        expect(canonicalAdministrativeTaskRefs({ masterHash: 'a'.repeat(40), trackId: undefined }))
            .toBe(canonicalAdministrativeTaskRefs({ masterHash: 'a'.repeat(40) }));
    });
});
