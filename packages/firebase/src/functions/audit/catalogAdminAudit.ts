import { Inngest } from 'inngest';
import { getFirestore } from 'firebase-admin/firestore';
import type { TaskEntityRefs } from '@indii/shared';
import {
    auditCatalogEntity,
    buildAdministrativeTask,
    emitAdministrativeTasks,
    type CatalogEntitySnapshot,
    type DeterministicFinding,
    type EmitResult,
} from './catalogAudit';
import { applySeverityTriage, triageAuditFindings } from './judgments';
import { setMasterOpenTasks } from './masterFsm';

/**
 * catalogAdminAudit — the durable background audit worker (Post-Mastering
 * Administrative Engine P2; plan §2.2.1).
 *
 * Deterministic code owns the workflow: load → audit → triage (Jev refines,
 * baseline falls back) → emit idempotent tasks → sync master pointers.
 * Each stage is an Inngest step, so retries resume without re-running stages.
 */

// Lazy Firestore handle (import-crash class, see 2179e43a).
function getDb() {
    return getFirestore();
}

export type AuditEntityType = 'master' | 'track' | 'release';

export interface CatalogAuditEventPayload {
    userId: string;
    entityType: AuditEntityType;
    entityRefs: TaskEntityRefs;
    receiptId?: string;
}

export interface AuditWorkerResult extends EmitResult {
    entityFound: boolean;
    findingTypes: string[];
    triage: { source: string; releaseBlocking: boolean; priority: string; suppress: boolean };
}

// ── Entity → audit snapshot mappers ────────────────────────────────────────

function str(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Release records (`proprietaryIngestionReleases`) carry ExtendedGoldenMetadata.
 * Releases REQUIRE splits — absence is itself a blocking finding.
 */
export function snapshotFromReleaseData(data: Record<string, unknown>): CatalogEntitySnapshot {
    const metadata = (data['metadata'] ?? {}) as Record<string, unknown>;
    const splits = (metadata['recordingSplits'] ?? metadata['splits']) as Record<string, unknown>[] | undefined;
    const compositionSplits = metadata['compositionSplits'] as Record<string, unknown>[] | undefined;
    return {
        title: str(metadata['trackTitle']),
        isrc: str(metadata['isrc']),
        iswc: str(metadata['iswc']),
        upc: str(metadata['upc']),
        explicitFlag: typeof metadata['explicit'] === 'boolean' ? metadata['explicit'] as boolean : null,
        releaseDate: str(metadata['releaseDate']),
        territories: Array.isArray(metadata['territories']) ? metadata['territories'] as string[] : null,
        language: str(metadata['language']),
        recordingYear: typeof metadata['recordingYear'] === 'number' ? metadata['recordingYear'] as number : null,
        artistRoles: Array.isArray(metadata['artistRoles']) ? metadata['artistRoles'] as string[] : null,
        recordingSplits: Array.isArray(splits) ? splits.map(splitEntry) : null,
        compositionSplits: Array.isArray(compositionSplits) ? compositionSplits.map(splitEntry) : null,
        writers: Array.isArray(splits) ? splits.map(writerEntry) : null,
        requireSplits: true,
    };
}

/** Track records (`users/{uid}/tracks`) — splits checked only when present. */
export function snapshotFromTrackData(data: Record<string, unknown>): CatalogEntitySnapshot {
    return {
        title: str(data['title']),
        isrc: str(data['isrc']),
        iswc: str(data['iswc']),
        explicitFlag: typeof data['explicit'] === 'boolean' ? data['explicit'] as boolean : null,
        language: str(data['language']),
        requireSplits: false,
    };
}

/** Master records (from an analysis receipt) — descriptive fields only. */
export function snapshotFromReceiptData(data: Record<string, unknown>): CatalogEntitySnapshot {
    const gemini = (data['geminiProfile'] ?? {}) as Record<string, unknown>;
    const technical = (data['technical'] ?? {}) as Record<string, unknown>;
    return {
        title: str(technical['originalFileName']) ?? str(data['masterFingerprint']),
        language: str(gemini['language']),
        explicitFlag: gemini['clean_or_explicit_signal'] === 'explicit' ? true : gemini['clean_or_explicit_signal'] === 'clean' ? false : null,
        requireSplits: false,
    };
}

function splitEntry(entry: Record<string, unknown>): { collaboratorId?: string; name?: string; percentage: number } {
    return {
        collaboratorId: typeof entry['collaboratorId'] === 'string' ? entry['collaboratorId'] : undefined,
        name: typeof entry['legalName'] === 'string' ? entry['legalName'] : typeof entry['name'] === 'string' ? entry['name'] : undefined,
        percentage: typeof entry['percentage'] === 'number' ? entry['percentage'] : Number.NaN,
    };
}

function writerEntry(entry: Record<string, unknown>): { name: string; collaboratorId?: string; proAffiliation?: string | null; ipiNumber?: string | null } {
    return {
        name: typeof entry['legalName'] === 'string' ? entry['legalName'] : typeof entry['name'] === 'string' ? entry['name'] : 'unknown',
        collaboratorId: typeof entry['collaboratorId'] === 'string' ? entry['collaboratorId'] : undefined,
        proAffiliation: typeof entry['proAffiliation'] === 'string' ? entry['proAffiliation'] : null,
        ipiNumber: typeof entry['ipiNumber'] === 'string' ? entry['ipiNumber'] : null,
    };
}

// ── Findings → tasks ───────────────────────────────────────────────────────

export function findingsToTasks(params: {
    userId: string;
    entityType: AuditEntityType;
    baseRefs: TaskEntityRefs;
    results: DeterministicFinding[];
    now?: Date;
}) {
    return resultsToTasks(params.userId, params.entityType, params.baseRefs, params.results, params.now);
}

function resultsToTasks(
    userId: string,
    entityType: AuditEntityType,
    baseRefs: TaskEntityRefs,
    results: DeterministicFinding[],
    now?: Date,
) {
    return results.map((result) => {
        // Per-writer findings (PRO/IPI) embed the writer in the observed text;
        // their dedupe refs must differ per writer so each gets its own task.
        const observed = result.findings[0]?.observed ?? '';
        const writerMatch = /^(.*?)(?: has a PRO affiliation| has an IPI)/.exec(observed);
        const refs: TaskEntityRefs =
            (result.taskType === 'SPLIT_PRO_AFFILIATION_MISSING' || result.taskType === 'SPLIT_IPI_MISSING') && writerMatch
                ? { ...baseRefs, collaboratorId: writerMatch[1] }
                : baseRefs;
        return buildAdministrativeTask({
            userId,
            type: result.taskType,
            severity: result.severity,
            entityType,
            refs,
            findings: result.findings,
            now,
        });
    });
}

// ── Entity loading ──────────────────────────────────────────────────────────

async function loadSnapshot(payload: CatalogAuditEventPayload): Promise<{ snapshot: CatalogEntitySnapshot; found: boolean } | undefined> {
    const db = getDb();
    if (payload.entityType === 'release') {
        const releaseId = payload.entityRefs.releaseId;
        if (!releaseId) return undefined;
        const snap = await db.collection('proprietaryIngestionReleases').doc(releaseId).get();
        if (!snap.exists) return { snapshot: { requireSplits: false }, found: false };
        return { snapshot: snapshotFromReleaseData(snap.data() ?? {}), found: true };
    }
    if (payload.entityType === 'track') {
        const trackId = payload.entityRefs.trackId;
        if (!trackId) return undefined;
        const snap = await db.collection('users').doc(payload.userId).collection('tracks').doc(trackId).get();
        if (!snap.exists) return { snapshot: { requireSplits: false }, found: false };
        return { snapshot: snapshotFromTrackData(snap.data() ?? {}), found: true };
    }
    // master — via analysis receipt
    if (!payload.receiptId) return undefined;
    const snap = await db.collection('audio_analysis_receipts').doc(payload.receiptId).get();
    if (!snap.exists) return { snapshot: { requireSplits: false }, found: false };
    return { snapshot: snapshotFromReceiptData(snap.data() ?? {}), found: true };
}

// ── Inngest function ────────────────────────────────────────────────────────

export const catalogAdminAuditFn = (inngestClient: Inngest) =>
    inngestClient.createFunction(
        {
            id: 'catalog-admin-audit',
            retries: 2,
            concurrency: { limit: 5 },
        },
        { event: 'admin/audit.requested' },
        async ({ event, step }): Promise<AuditWorkerResult> => {
            const payload = event.data as CatalogAuditEventPayload;

            const loaded = await step.run('load-entity', async () => loadSnapshot(payload));
            if (!loaded) {
                return { entityFound: false, findingTypes: [], written: [], skipped: [], triage: { source: 'heuristic', releaseBlocking: false, priority: 'MONITOR_ONLY', suppress: true } };
            }

            const audited = await step.run('audit-entity', async () => {
                const results = auditCatalogEntity(loaded.snapshot);
                return {
                    results,
                    summary: {
                        title: loaded.snapshot.title ?? undefined,
                        entityTypes: [payload.entityType],
                        findingsSummary: results.map((result) => ({
                            taskType: result.taskType,
                            severity: result.severity,
                            count: result.findings.length,
                        })),
                    },
                };
            });

            const triaged = await step.run('triage-with-jev', async () => {
                const verdict = await triageAuditFindings(audited.summary);
                return { results: applySeverityTriage(audited.results, verdict), verdict };
            });

            const emitted = await step.run('emit-tasks', async () => {
                const tasks = resultsToTasks(payload.userId, payload.entityType, payload.entityRefs, triaged.results);
                return emitAdministrativeTasks(getDb() as unknown as Parameters<typeof emitAdministrativeTasks>[0], tasks);
            });

            if (payload.entityRefs.masterHash) {
                await step.run('sync-master-open-tasks', async () => {
                    await setMasterOpenTasks(payload.userId, payload.entityRefs.masterHash!, emitted.written);
                });
            }

            return {
                entityFound: loaded.found,
                findingTypes: triaged.results.map((result) => result.taskType),
                written: emitted.written,
                skipped: emitted.skipped,
                triage: {
                    source: triaged.verdict.source,
                    releaseBlocking: triaged.verdict.releaseBlocking,
                    priority: triaged.verdict.priority,
                    suppress: triaged.verdict.suppress,
                },
            };
        },
    );
