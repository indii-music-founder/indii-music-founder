import { describe, expect, it } from 'vitest';
import {
    administrativeTaskDedupeKey,
    auditCatalogEntity,
    buildAdministrativeTask,
    emitAdministrativeTasks,
    type CatalogEntitySnapshot,
} from './catalogAudit.js';

const cleanRelease = (overrides: Partial<CatalogEntitySnapshot> = {}): CatalogEntitySnapshot => ({
    title: 'Midnight Motorway',
    isrc: 'USABC7123456',
    iswc: 'T-034524680-1',
    upc: '036000291452',
    explicitFlag: false,
    releaseDate: '2026-11-06',
    territories: ['US', 'GB'],
    language: 'en',
    recordingYear: 2026,
    artistRoles: ['MAIN_ARTIST'],
    recordingSplits: [
        { collaboratorId: 'artist-1', percentage: 50 },
        { collaboratorId: 'producer-1', percentage: 50 },
    ],
    compositionSplits: [
        { collaboratorId: 'artist-1', percentage: 50 },
        { collaboratorId: 'writer-1', percentage: 50 },
    ],
    writers: [
        { name: 'Artist One', collaboratorId: 'artist-1', proAffiliation: 'BMI', ipiNumber: '000141073289' },
        { name: 'Producer One', collaboratorId: 'producer-1', proAffiliation: 'ASCAP', ipiNumber: '000141073290' },
    ],
    requireSplits: true,
    ...overrides,
});

describe('auditCatalogEntity (deterministic core)', () => {
    it('passes a fully populated, exactly-split release', () => {
        expect(auditCatalogEntity(cleanRelease())).toEqual([]);
    });

    it('flags ISRC-without-ISWC and ISWC-without-ISRC pairing gaps', () => {
        const withoutIswc = auditCatalogEntity(cleanRelease({ iswc: null }));
        expect(withoutIswc.map((r) => r.taskType)).toContain('IDENTIFIER_ISRC_WITHOUT_ISWC');
        expect(withoutIswc.find((r) => r.taskType === 'IDENTIFIER_ISRC_WITHOUT_ISWC')?.severity).toBe('warning');

        const withoutIsrc = auditCatalogEntity(cleanRelease({ isrc: null }));
        expect(withoutIsrc.map((r) => r.taskType)).toContain('IDENTIFIER_ISWC_WITHOUT_ISRC');
    });

    it('blocks invalid identifier formats and mandatory metadata violations', () => {
        const results = auditCatalogEntity(cleanRelease({
            isrc: 'usabc7123456',
            explicitFlag: null,
            releaseDate: '11/06/2026',
            territories: [],
            language: null,
            recordingYear: null,
            artistRoles: [],
        }));
        const types = results.map((r) => r.taskType);
        expect(types).toContain('IDENTIFIER_FORMAT_INVALID');
        expect(types).toContain('METADATA_MANDATORY_FIELD');
        expect(results.find((r) => r.taskType === 'METADATA_MANDATORY_FIELD')?.severity).toBe('blocking');
    });

    it('blocks split sums that only LOOK like 100 under float math', () => {
        const results = auditCatalogEntity(cleanRelease({
            recordingSplits: [
                { collaboratorId: 'a', percentage: 33.333333 },
                { collaboratorId: 'b', percentage: 33.333333 },
                { collaboratorId: 'c', percentage: 33.333334 },
            ],
        }));
        expect(results.map((r) => r.taskType)).toContain('SPLIT_SUM_MASTER');
        // composition splits remain exact — no false positive:
        expect(results.map((r) => r.taskType)).not.toContain('SPLIT_SUM_PUBLISHING');
    });

    it('blocks missing splits on releases (requireSplits) but stays silent for tracks without splits', () => {
        const release = auditCatalogEntity(cleanRelease({ recordingSplits: null, compositionSplits: null, writers: null }));
        expect(release.map((r) => r.taskType)).toContain('SPLIT_SUM_MASTER');
        expect(release.map((r) => r.taskType)).toContain('SPLIT_SUM_PUBLISHING');

        const track = auditCatalogEntity({ title: 'demo', explicitFlag: false, language: 'en', requireSplits: false });
        expect(track.map((r) => r.taskType)).not.toContain('SPLIT_SUM_MASTER');
    });

    it('flags per-writer PRO affiliation and IPI gaps', () => {
        const results = auditCatalogEntity(cleanRelease({
            writers: [
                { name: 'Artist One', collaboratorId: 'artist-1', proAffiliation: 'BMI', ipiNumber: '000141073289' },
                { name: 'Producer One', collaboratorId: 'producer-1', proAffiliation: null, ipiNumber: null },
            ],
        }));
        const proTasks = results.filter((r) => r.taskType === 'SPLIT_PRO_AFFILIATION_MISSING');
        const ipiTasks = results.filter((r) => r.taskType === 'SPLIT_IPI_MISSING');
        expect(proTasks).toHaveLength(1);
        expect(ipiTasks).toHaveLength(1);
        expect(proTasks[0]!.findings[0]!.observed).toBe('missing');
    });

    it('is deterministic and order-stable', () => {
        expect(auditCatalogEntity(cleanRelease({ iswc: null }))).toEqual(auditCatalogEntity(cleanRelease({ iswc: null })));
    });
});

describe('administrative task construction & emission', () => {
    it('builds schema-valid tasks with stable dedupe keys', () => {
        const refs = { masterHash: 'a'.repeat(40) };
        const task = buildAdministrativeTask({
            userId: 'user-1',
            type: 'IDENTIFIER_ISRC_WITHOUT_ISWC',
            severity: 'warning',
            entityType: 'master',
            refs,
            findings: [{ field: 'iswc', expected: 'present', observed: 'missing', source: 'identifier-cross-validation.v1' }],
            now: new Date('2026-09-26T12:00:00Z'),
        });
        expect(task.id).toBe(administrativeTaskDedupeKey('IDENTIFIER_ISRC_WITHOUT_ISWC', refs));
        expect(task.id).toBe(task.dedupeKey);
        expect(task.status).toBe('open');
        expect(task.resolvedAt).toBeNull();
        // Stable across call order of refs:
        expect(administrativeTaskDedupeKey('IDENTIFIER_ISRC_WITHOUT_ISWC', refs))
            .toBe(administrativeTaskDedupeKey('IDENTIFIER_ISRC_WITHOUT_ISWC', { masterHash: 'a'.repeat(40) }));
    });

    it('marks staged actions action_ready and keeps requiresApproval true', () => {
        const task = buildAdministrativeTask({
            userId: 'user-1',
            type: 'IDENTIFIER_ISWC_WITHOUT_ISRC',
            severity: 'warning',
            entityType: 'master',
            refs: { masterHash: 'a'.repeat(40) },
            findings: [],
            proposedAction: { kind: 'staged_registration_payload', payload: { registry: 'CWR' }, requiresApproval: true, builderRef: 'draftCwrRegistration@v1' },
        });
        expect(task.status).toBe('action_ready');
        expect(task.proposedAction?.requiresApproval).toBe(true);
    });

    it('emits tasks but never resurrects executed or dismissed decisions', async () => {
        const stored = new Map<string, Record<string, unknown>>();
        const db = {
            collection: () => ({
                doc: (id: string) => ({
                    id,
                    get: async () => ({ exists: stored.has(id), data: () => stored.get(id) }),
                    set: async (data: unknown) => { stored.set(id, data as Record<string, unknown>); },
                }),
            }),
        };

        const refs = { masterHash: 'a'.repeat(40) };
        const make = () => buildAdministrativeTask({
            userId: 'user-1',
            type: 'SPLIT_IPI_MISSING',
            severity: 'critical',
            entityType: 'master',
            refs,
            findings: [{ field: 'ipiNumber', expected: 'present', observed: 'missing', source: 'split-completeness.v1' }],
        });

        const first = await emitAdministrativeTasks(db, [make()]);
        expect(first.written).toHaveLength(1);
        expect(first.skipped).toHaveLength(0);

        // Re-audit overwrites the still-open task idempotently:
        const second = await emitAdministrativeTasks(db, [make()]);
        expect(second.written).toHaveLength(1);

        // Human resolved it — the audit must not resurrect it:
        stored.set(make().id, { ...make(), status: 'dismissed' } as Record<string, unknown>);
        const third = await emitAdministrativeTasks(db, [make()]);
        expect(third.skipped).toEqual([make().id]);
        expect(third.written).toHaveLength(0);
        expect(stored.get(make().id)?.['status']).toBe('dismissed');
    });
});
