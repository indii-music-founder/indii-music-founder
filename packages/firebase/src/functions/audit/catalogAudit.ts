import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import {
    auditMandatoryMetadata,
    canonicalAdministrativeTaskRefs,
    splitsResolveExactly,
    AdministrativeTaskSchema,
    type AdministrativeTask,
    type AdministrativeTaskSeverity,
    type AdministrativeTaskType,
    type TaskEntityRefs,
    type TaskFinding,
} from '@indii/shared';

/**
 * catalogAudit — deterministic catalog audit engine (Post-Mastering
 * Administrative Engine P2; plan §2.2.1 / §3 Step 2–4).
 *
 * Every check here is pure and deterministic: identifier cross-validation,
 * exact share-unit split resolution, PRO/IPI completeness, and the shared
 * mandatory-metadata contract. Jev (see ./judgments.ts) only REFINES
 * severities around these findings — it can never create, silence a
 * `blocking` finding, or alter task identity.
 *
 * Task identity is the deterministic dedupe key
 * `{type}_{sha256(canonical refs)[:24]}` so re-audits can never duplicate.
 */

export interface CatalogSplitEntry {
    collaboratorId?: string;
    name?: string;
    percentage: number;
}

export interface CatalogWriterEntry {
    name: string;
    collaboratorId?: string;
    proAffiliation?: string | null;
    ipiNumber?: string | null;
}

/** Loose, defensive snapshot of a catalog entity (track/master/release). */
export interface CatalogEntitySnapshot {
    title?: string | null;
    isrc?: string | null;
    iswc?: string | null;
    upc?: string | null;
    explicitFlag?: boolean | null;
    releaseDate?: string | null;
    territories?: string[] | null;
    language?: string | null;
    recordingYear?: number | null;
    artistRoles?: string[] | null;
    /** Master-side splits; legacy fallback field `splits` is honored. */
    recordingSplits?: CatalogSplitEntry[] | null;
    compositionSplits?: CatalogSplitEntry[] | null;
    writers?: CatalogWriterEntry[] | null;
    /**
     * Releases REQUIRE splits (absence is a blocking finding); tracks and
     * bare masters are only audited for splits when arrays exist.
     */
    requireSplits?: boolean;
}

const IDENTIFIER_FIELDS = new Set(['isrc', 'upc', 'iswc']);

export interface DeterministicFinding {
    taskType: AdministrativeTaskType;
    severity: AdministrativeTaskSeverity;
    findings: TaskFinding[];
}

function taskFinding(field: string, expected: string, observed: string, source: string): TaskFinding {
    return { field, expected, observed, source };
}

/** Exact-sum check over a split list; absent lists fail only when required. */
function splitResolves(splits: CatalogSplitEntry[] | null | undefined, required: boolean): { ok: boolean; observed: string } {
    if (!splits || splits.length === 0) {
        return required
            ? { ok: false, observed: 'no splits recorded' }
            : { ok: true, observed: 'not provided' };
    }
    const ok = splitsResolveExactly(splits.map((split) => split.percentage));
    const rawSum = splits.reduce((total, split) => total + split.percentage, 0);
    return { ok, observed: `${rawSum}% across ${splits.length} entries` };
}

/**
 * Pure audit: identifier cross-validation, split sums (share units), PRO/IPI
 * completeness, and mandatory metadata. Deterministic and order-stable.
 */
export function auditCatalogEntity(entity: CatalogEntitySnapshot): DeterministicFinding[] {
    const results: DeterministicFinding[] = [];

    // ── Identifier cross-validation ──
    const hasIsrc = Boolean(entity.isrc);
    const hasIswc = Boolean(entity.iswc);
    if (hasIsrc && !hasIswc) {
        results.push({
            taskType: 'IDENTIFIER_ISRC_WITHOUT_ISWC',
            severity: 'warning',
            findings: [taskFinding('iswc', 'ISWC present when ISRC is present', 'missing', 'identifier-cross-validation.v1')],
        });
    }
    if (hasIswc && !hasIsrc) {
        results.push({
            taskType: 'IDENTIFIER_ISWC_WITHOUT_ISRC',
            severity: 'warning',
            findings: [taskFinding('isrc', 'ISRC present when ISWC is present', 'missing', 'identifier-cross-validation.v1')],
        });
    }

    // ── Mandatory metadata + identifier FORMAT (one shared contract) ──
    const mandatory = auditMandatoryMetadata({
        explicitFlag: entity.explicitFlag ?? undefined,
        releaseDate: entity.releaseDate ?? undefined,
        territories: entity.territories ?? undefined,
        language: entity.language ?? undefined,
        recordingYear: entity.recordingYear ?? undefined,
        artistRoles: entity.artistRoles ?? undefined,
        isrc: entity.isrc ?? undefined,
        upc: entity.upc ?? undefined,
        iswc: entity.iswc ?? undefined,
    });
    const mandatoryFindings = mandatory.filter((finding) => !IDENTIFIER_FIELDS.has(finding.field));
    if (mandatoryFindings.length > 0) {
        results.push({
            taskType: 'METADATA_MANDATORY_FIELD',
            severity: 'blocking',
            findings: mandatoryFindings.map((finding) => taskFinding(finding.field, finding.requirement, finding.observed, finding.source)),
        });
    }
    const identifierFormatFindings = mandatory.filter((finding) => IDENTIFIER_FIELDS.has(finding.field));
    if (identifierFormatFindings.length > 0) {
        results.push({
            taskType: 'IDENTIFIER_FORMAT_INVALID',
            severity: 'blocking',
            findings: identifierFormatFindings.map((finding) => taskFinding(finding.field, finding.requirement, finding.observed, finding.source)),
        });
    }

    // ── Split completeness & exact sums ──
    const splitsRequired = entity.requireSplits === true;
    const recording = splitResolves(entity.recordingSplits, splitsRequired);
    if (!recording.ok) {
        results.push({
            taskType: 'SPLIT_SUM_MASTER',
            severity: 'blocking',
            findings: [taskFinding('recordingSplits', 'recording splits resolve to exactly 100.00%', recording.ok ? '100.00%' : recording.observed, 'share-units.v1')],
        });
    }
    const publishing = splitResolves(entity.compositionSplits, splitsRequired);
    if (!publishing.ok) {
        results.push({
            taskType: 'SPLIT_SUM_PUBLISHING',
            severity: 'blocking',
            findings: [taskFinding('compositionSplits', 'publishing splits resolve to exactly 100.00%', publishing.ok ? '100.00%' : publishing.observed, 'share-units.v1')],
        });
    }

    // ── Co-writer PRO affiliation & IPI completeness (per writer) ──
    for (const writer of entity.writers ?? []) {
        if (!writer.proAffiliation || writer.proAffiliation.trim() === '' || writer.proAffiliation === 'None') {
            results.push({
                taskType: 'SPLIT_PRO_AFFILIATION_MISSING',
                severity: 'critical',
                findings: [taskFinding('proAffiliation', `${writer.name} has a PRO affiliation on file`, writer.proAffiliation ?? 'missing', 'split-completeness.v1')],
            });
        }
        if (!writer.ipiNumber || writer.ipiNumber.trim() === '') {
            results.push({
                taskType: 'SPLIT_IPI_MISSING',
                severity: 'critical',
                findings: [taskFinding('ipiNumber', `${writer.name} has an IPI/CAE number on file`, 'missing', 'split-completeness.v1')],
            });
        }
    }

    return results;
}

// ---------------------------------------------------------------------------
// Task construction & persistence
// ---------------------------------------------------------------------------

export interface BuildTaskParams {
    userId: string;
    type: AdministrativeTaskType;
    severity: AdministrativeTaskSeverity;
    entityType: 'master' | 'track' | 'release' | 'composition' | 'collaborator';
    refs: TaskEntityRefs;
    findings: TaskFinding[];
    proposedAction?: AdministrativeTask['proposedAction'];
    jevRef?: AdministrativeTask['jevRef'];
    now?: Date;
}

/** Deterministic dedupe key: `{type}_{sha256(canonical refs)[:24]}`. */
export function administrativeTaskDedupeKey(type: AdministrativeTaskType, refs: TaskEntityRefs): string {
    const digest = createHash('sha256').update(canonicalAdministrativeTaskRefs(refs), 'utf8').digest('hex');
    return `${type}_${digest.slice(0, 24)}`;
}

export function buildAdministrativeTask(params: BuildTaskParams): AdministrativeTask {
    const nowIso = (params.now ?? new Date()).toISOString();
    const id = administrativeTaskDedupeKey(params.type, params.refs);
    return AdministrativeTaskSchema.parse({
        id,
        userId: params.userId,
        schemaVersion: 'administrative-task.v1',
        type: params.type,
        severity: params.severity,
        status: params.proposedAction ? 'action_ready' : 'open',
        entityType: params.entityType,
        entityRefs: params.refs,
        findings: params.findings,
        proposedAction: params.proposedAction ?? null,
        jevRef: params.jevRef ?? null,
        dedupeKey: id,
        createdAt: nowIso,
        updatedAt: nowIso,
        resolvedAt: null,
    });
}

/** ISO-string domain task → Firestore document (timestamp fields per rules). */
export function toFirestoreTask(task: AdministrativeTask): Record<string, unknown> {
    const toTimestamp = (iso: string) => Timestamp.fromDate(new Date(iso));
    return {
        ...task,
        createdAt: toTimestamp(task.createdAt),
        updatedAt: toTimestamp(task.updatedAt),
        resolvedAt: task.resolvedAt ? toTimestamp(task.resolvedAt) : null,
    };
}

export interface EmitResult {
    written: string[];
    /** Tasks whose existing doc is executed/dismissed — never resurrected. */
    skipped: string[];
}

export interface AdminTaskFirestore {
    collection(path: string): {
        doc(id?: string): {
            id: string;
            get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
            set(data: unknown, opts?: { merge?: boolean }): Promise<unknown>;
        };
    };
}

/**
 * Idempotent task emission. Re-audits overwrite the same open task (dedupe
 * key), but an executed or dismissed task is NEVER resurrected by a later
 * audit — the human decision stands.
 */
export async function emitAdministrativeTasks(
    db: AdminTaskFirestore,
    tasks: AdministrativeTask[],
): Promise<EmitResult> {
    const collection = db.collection('administrative_tasks');
    const written: string[] = [];
    const skipped: string[] = [];
    for (const task of tasks) {
        const reference = collection.doc(task.id);
        const existing = await reference.get();
        if (existing.exists) {
            const status = existing.data()?.['status'];
            if (status === 'executed' || status === 'dismissed') {
                skipped.push(task.id);
                continue;
            }
        }
        await reference.set(toFirestoreTask(task), { merge: false });
        written.push(task.id);
    }
    return { written, skipped };
}
