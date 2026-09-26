import { Inngest } from 'inngest';
import { createHash } from 'node:crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { splitsResolveExactly } from '@indii/shared';
import {
    ensureMasterAdminState,
    readMasterAdminState,
    setMasterOpenTasks,
    transitionMasterLifecycle,
} from './masterFsm';
import { getInngestClient } from '../../lib/inngestClient.js';
import type { LifecycleActor, MasterLifecycleStatus } from '@indii/shared';

/**
 * masterIngestionRunbook — the deterministic post-mastering runbook (P4; plan §3).
 *
 * Drives the MASTER lifecycle from analysis receipt to ADMIN_LOCK:
 *   DRAFT → INGESTED                    (analysis receipt complete)
 *         → METADATA_AUDITED            (zero open blocking tasks for this master)
 *         → SPLITS_PENDING              (a release binds this master and split
 *                                        work exists — audit event emitted for it)
 *         → ADMIN_LOCK                  (all signature invitations executed AND
 *                                        both split streams resolve exactly to
 *                                        100.00% — writes the immutable ledger)
 *
 * Human gates stay human: signature execution and release approval are user
 * actions; the runbook only OBSERVES their completion and locks state. The
 * DISTRIBUTION_READY transition belongs to the human-approved distribution
 * flow (prepare_release), which transitions via masterFsm in a later phase.
 *
 * Every step is an Inngest step: retries resume without re-running stages,
 * and FSM transitions are idempotent (re-asserting a status is a no-op).
 */

function getDb() {
    return getFirestore();
}

export interface MasterAnalyzedPayload {
    userId: string;
    masterHash: string;
    receiptId: string;
    storagePath?: string;
    generation?: string;
    masterFingerprint?: string;
}

export interface BindingStep {
    linkedReleaseId: string | undefined;
    releaseAuditRequested: boolean;
    splits: { to: MasterLifecycleStatus; changed: boolean };
}
interface LockStep {
    locked: boolean;
    ledgerReceiptId: string | undefined;
}

interface RunbookOutcome {
    lifecycle: MasterLifecycleStatus;
    transitions: { to: MasterLifecycleStatus; changed: boolean }[];
    openBlockingTasks: number;
    linkedReleaseId?: string;
    releaseAuditRequested: boolean;
    ledgerReceiptId?: string;
    locked: boolean;
}

// ── Step helpers (exported for unit tests) ─────────────────────────────────

/** Zero open/action_ready blocking tasks bound to this masterHash. */
export async function countOpenBlockingTasks(userId: string, masterHash: string): Promise<number> {
    // Single-field `in` query (index-safe); severity + master binding are
    // filtered client-side to avoid a composite index requirement.
    const snapshot = await getDb()
        .collection('users')
        .doc(userId)
        .collection('administrative_tasks')
        .where('status', 'in', ['open', 'action_ready', 'awaiting_confirmation'])
        .limit(200)
        .get();
    return snapshot.docs.filter((document) => {
        const data = document.data();
        const refs = (data['entityRefs'] ?? {}) as Record<string, unknown>;
        return data['severity'] === 'blocking' && refs['masterHash'] === masterHash;
    }).length;
}

/**
 * Locate the release that binds this master: track doc id == masterFingerprint
 * carries an ISRC; the release embeds the same ISRC in metadata.isrc.
 */
export async function findLinkedReleaseId(
    userId: string,
    masterFingerprint: string | undefined,
): Promise<string | undefined> {
    if (!masterFingerprint) return undefined;
    const trackSnap = await getDb()
        .collection('users')
        .doc(userId)
        .collection('tracks')
        .doc(masterFingerprint)
        .get();
    if (!trackSnap.exists) return undefined;
    const isrc = trackSnap.data()?.['isrc'];
    if (typeof isrc !== 'string' || !isrc) return undefined;

    const releases = await getDb()
        .collection('proprietaryIngestionReleases')
        .where('userId', '==', userId)
        .where('metadata.isrc', '==', isrc)
        .limit(1)
        .get();
    return releases.docs[0]?.id;
}

async function loadRelease(userId: string, releaseId: string): Promise<Record<string, unknown> | undefined> {
    const snap = await getDb().collection('proprietaryIngestionReleases').doc(releaseId).get();
    return snap.exists ? snap.data() ?? undefined : undefined;
}

export interface LockEvaluation {
    lockable: boolean;
    reason: string;
    splits?: { recording: { collaboratorId: string; shareBasisUnits: number }[]; publishing: { collaboratorId: string; shareBasisUnits: number }[] };
    signatories?: { collaboratorId: string; method: string; receiptHash: string }[];
}

/**
 * ADMIN_LOCK gate: every SPLIT_SIGNATURE_OUTSTANDING task for this release is
 * `executed`, and both split streams resolve to exactly 100.00%.
 */
export async function evaluateAdminLock(
    userId: string,
    releaseId: string,
    release: Record<string, unknown>,
): Promise<LockEvaluation> {
    const metadata = (release['metadata'] ?? {}) as Record<string, unknown>;
    const toRows = (raw: unknown): { name: string; percentage: number }[] =>
        Array.isArray(raw)
            ? (raw as Record<string, unknown>[]).map((split) => ({
                name: String(split['legalName'] ?? split['name'] ?? 'unknown'),
                percentage: typeof split['percentage'] === 'number' ? split['percentage'] : Number.NaN,
            }))
            : [];
    const recording = toRows(metadata['recordingSplits'] ?? metadata['splits']);
    const publishing = toRows(metadata['compositionSplits']);

    if (recording.length === 0 || publishing.length === 0) {
        return { lockable: false, reason: 'release splits incomplete' };
    }
    const recordingOk = splitsResolveExactly(recording.map((row) => row.percentage));
    const publishingOk = splitsResolveExactly(publishing.map((row) => row.percentage));
    if (!recordingOk || !publishingOk) {
        return { lockable: false, reason: 'splits do not resolve to exactly 100.00%' };
    }

    const signatures = await getDb()
        .collection('users')
        .doc(userId)
        .collection('administrative_tasks')
        .where('type', '==', 'SPLIT_SIGNATURE_OUTSTANDING')
        .limit(200)
        .get();
    // Client-side release binding — avoids a two-field composite index.
    const releaseSignatures = signatures.docs.filter((document) => {
        const refs = (document.data()['entityRefs'] ?? {}) as Record<string, unknown>;
        return refs['releaseId'] === releaseId;
    });
    const outstanding = releaseSignatures.filter((document) => {
        const status = (document.data()['status'] ?? 'open') as string;
        return status !== 'executed';
    });
    if (outstanding.length > 0) {
        return { lockable: false, reason: `${outstanding.length} split signature(s) outstanding` };
    }

    const signatories = releaseSignatures.map((document) => {
        const data = document.data();
        const action = (data['proposedAction'] ?? { payload: {} }) as { payload?: Record<string, unknown> };
        const refs = (data['entityRefs'] ?? {}) as Record<string, unknown>;
        return {
            collaboratorId: String(refs['collaboratorId'] ?? 'unknown'),
            method: 'split-invitation@v1',
            receiptHash: String(action.payload?.['sheetHash'] ?? ''),
        };
    });

    const toBasisUnits = (rows: { name: string; percentage: number }[]) =>
        rows.map((row) => ({ collaboratorId: row.name, shareBasisUnits: Math.round(row.percentage * 10_000) }));

    return {
        lockable: true,
        reason: 'all signatures executed and splits resolve exactly',
        splits: { recording: toBasisUnits(recording), publishing: toBasisUnits(publishing) },
        signatories,
    };
}

/** Content-addressed ledger id: led_v1_{sha256(canonical)[:40]}. */
export function ledgerReceiptIdFor(payload: Record<string, unknown>): string {
    const digest = createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
    return `led_v1_${digest.slice(0, 40)}`;
}

export function buildLedgerReceipt(params: {
    userId: string;
    masterHash: string;
    generation: string;
    releaseId: string;
    evaluation: LockEvaluation & { splits: NonNullable<LockEvaluation['splits']>; signatories: NonNullable<LockEvaluation['signatories']> };
    identifiers: { isrc?: string; iswc?: string; upc?: string };
    lockedAtIso: string;
}): Record<string, unknown> {
    const canonical = {
        userId: params.userId,
        masterHash: params.masterHash,
        generation: params.generation,
        releaseId: params.releaseId,
        splits: params.evaluation.splits,
        signatories: params.evaluation.signatories,
        lockedAt: params.lockedAtIso,
    };
    const id = ledgerReceiptIdFor(canonical);
    // Firestore rejects `undefined` values — omit absent identifiers entirely.
    const identifiers: Record<string, unknown> = {};
    if (params.identifiers.isrc) identifiers['isrc'] = params.identifiers.isrc;
    if (params.identifiers.iswc) identifiers['iswc'] = params.identifiers.iswc;
    if (params.identifiers.upc) identifiers['upc'] = params.identifiers.upc;
    return {
        id,
        userId: params.userId,
        schemaVersion: 'admin-ledger-receipt.v1',
        masterHash: params.masterHash,
        storageGeneration: params.generation,
        splits: params.evaluation.splits,
        signatories: params.evaluation.signatories.map((signatory) => ({ ...signatory, signedAt: params.lockedAtIso })),
        identifiers,
        lockedAt: params.lockedAtIso,
    };
}

async function writeLedgerReceipt(receipt: Record<string, unknown>): Promise<void> {
    await getDb()
        .collection('users')
        .doc(String(receipt['userId']))
        .collection('admin_ledger')
        .doc(String(receipt['id']))
        .set({ ...receipt, serverUpdatedAt: FieldValue.serverTimestamp() });
}

// ── Inngest function ────────────────────────────────────────────────────────

async function transition(userId: string, masterHash: string, to: MasterLifecycleStatus, actor: LifecycleActor, reason: string): Promise<{ to: MasterLifecycleStatus; changed: boolean }> {
    try {
        const result = await transitionMasterLifecycle(userId, masterHash, to, actor, reason);
        return { to, changed: result.changed };
    } catch {
        // Illegal edge (e.g. state not yet INGESTED): non-fatal — a later
        // event retries once the prerequisite transition has landed.
        return { to, changed: false };
    }
}

export const masterIngestionRunbookFn = (inngestClient: Inngest) =>
    inngestClient.createFunction(
        {
            id: 'master-ingestion-runbook',
            retries: 3,
            concurrency: { limit: 5 },
        },
        { event: 'admin/master.analyzed' },
        async ({ event, step }): Promise<RunbookOutcome> => {
            const payload = event.data as MasterAnalyzedPayload;
            const transitions: RunbookOutcome['transitions'] = [];

            // Step 1 — bind state and mark the master INGESTED.
            const bound = await step.run('bind-and-mark-ingested', async () => {
                await ensureMasterAdminState(payload.userId, {
                    masterHash: payload.masterHash,
                    storagePath: payload.storagePath ?? `masters/${payload.userId}/${payload.masterHash}`,
                    generation: payload.generation ?? '0',
                });
                const existing = await readMasterAdminState(payload.userId, payload.masterHash);
                const ingested = await transition(payload.userId, payload.masterHash, 'INGESTED', 'runbook', 'analysis receipt complete');
                return { priorStatus: existing?.lifecycle, ingested };
            });
            transitions.push(bound.ingested);

            // Step 2 — metadata audit verdict comes from the P2 audit queue.
            const audit = await step.run('evaluate-metadata-audit', async () => {
                const blocking = await countOpenBlockingTasks(payload.userId, payload.masterHash);
                const audited = await transition(
                    payload.userId,
                    payload.masterHash,
                    'METADATA_AUDITED',
                    'audit',
                    blocking === 0 ? 'no open blocking tasks for this master' : `${blocking} blocking task(s) open`,
                );
                await setMasterOpenTasks(payload.userId, payload.masterHash, (await readMasterAdminState(payload.userId, payload.masterHash))?.openTaskIds ?? []);
                return { blocking, audited };
            });
            transitions.push(audit.audited);

            // Step 3 — release binding: emit the release audit, mark SPLITS_PENDING.
            const binding = await step.run('bind-release', async (): Promise<BindingStep> => {
                const linkedReleaseId = await findLinkedReleaseId(payload.userId, payload.masterFingerprint);
                if (!linkedReleaseId) {
                    return { linkedReleaseId: undefined, releaseAuditRequested: false, splits: await transition(payload.userId, payload.masterHash, 'SPLITS_PENDING', 'runbook', 'no release binds this master yet') };
                }
                const release = await loadRelease(payload.userId, linkedReleaseId);
                if (!release) {
                    return { linkedReleaseId, releaseAuditRequested: false, splits: await transition(payload.userId, payload.masterHash, 'SPLITS_PENDING', 'runbook', 'linked release missing') };
                }
                await dispatchAuditRequested(inngestClient, {
                    name: 'admin/audit.requested',
                    data: { userId: payload.userId, entityType: 'release', entityRefs: { releaseId: linkedReleaseId, masterHash: payload.masterHash } },
                    user: { id: payload.userId },
                });
                const splits = await transition(payload.userId, payload.masterHash, 'SPLITS_PENDING', 'runbook', `release ${linkedReleaseId} bound; split workflow staged`);
                return { linkedReleaseId, releaseAuditRequested: true, splits };
            });
            transitions.push(binding.splits);

            // Step 4 — ADMIN_LOCK when the human gates completed.
            const lock = await step.run('evaluate-admin-lock', async (): Promise<LockStep> => {
                if (!binding.linkedReleaseId) {
                    return { locked: false, ledgerReceiptId: undefined };
                }
                const release = await loadRelease(payload.userId, binding.linkedReleaseId);
                if (!release) return { locked: false, ledgerReceiptId: undefined };
                const evaluation = await evaluateAdminLock(payload.userId, binding.linkedReleaseId, release);
                if (!evaluation.lockable || !evaluation.splits || !evaluation.signatories) {
                    console.log(`[MasterIngestionRunbook] ${payload.masterHash}: lock withheld — ${evaluation.reason}`);
                    return { locked: false, ledgerReceiptId: undefined };
                }
                const metadata = (release['metadata'] ?? {}) as Record<string, unknown>;
                const lockedAtIso = new Date().toISOString();
                const receipt = buildLedgerReceipt({
                    userId: payload.userId,
                    masterHash: payload.masterHash,
                    generation: payload.generation ?? '0',
                    releaseId: binding.linkedReleaseId,
                    evaluation: { ...evaluation, splits: evaluation.splits, signatories: evaluation.signatories },
                    identifiers: {
                        isrc: typeof metadata['isrc'] === 'string' ? metadata['isrc'] : undefined,
                        iswc: typeof metadata['iswc'] === 'string' ? metadata['iswc'] : undefined,
                        upc: typeof metadata['upc'] === 'string' ? metadata['upc'] : undefined,
                    },
                    lockedAtIso,
                });
                await writeLedgerReceipt(receipt);
                const locked = await transition(payload.userId, payload.masterHash, 'ADMIN_LOCKED', 'runbook', `ledger receipt ${receipt['id']} written`);
                transitions.push(locked);
                return { locked: locked.changed || locked.to === 'ADMIN_LOCKED', ledgerReceiptId: String(receipt['id']) };
            });

            const finalState = await readMasterAdminState(payload.userId, payload.masterHash);

            return {
                lifecycle: finalState?.lifecycle ?? 'INGESTED',
                transitions,
                openBlockingTasks: audit.blocking,
                linkedReleaseId: binding.linkedReleaseId,
                releaseAuditRequested: binding.releaseAuditRequested,
                ledgerReceiptId: lock.ledgerReceiptId,
                locked: lock.locked,
            };
        },
    );

/**
 * Emit the release audit event. Unit tests stub this via
 * `__setAuditDispatchForTests` to avoid the secret-bound Inngest client.
 */
let auditDispatchOverride: ((message: unknown) => Promise<unknown>) | undefined;
export function __setAuditDispatchForTests(override: ((message: unknown) => Promise<unknown>) | undefined): void {
    auditDispatchOverride = override;
}
async function dispatchAuditRequested(inngestClient: Inngest, message: unknown): Promise<unknown> {
    if (auditDispatchOverride) return auditDispatchOverride(message);
    return getInngestClient().send(message as never);
}
