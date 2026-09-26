/**
 * CatalogAdminTools.ts — Post-Mastering Administrative Engine (P3; plan §2.3)
 *
 * Agent surface for the autonomous audit engine's output queue
 * (`users/{uid}/administrative_tasks`, P1) and its Jev triage layer (P2).
 *
 * Autonomy invariant (mirrors the risk registry + ExecApprovalService policy):
 * these tools STAGE and QUERY only. Staged payloads always carry
 * `requiresApproval: true`; executing one is a separate, human-confirmed
 * action. Nothing here submits registrations, publishes, moves money, or
 * contacts a third party on its own authority.
 */

import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { db, auth } from '@/services/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    limit as fsLimit,
    setDoc,
    serverTimestamp,
    type Timestamp,
} from 'firebase/firestore';
import { canonicalAdministrativeTaskRefs, splitsResolveExactly } from '@indii/shared';
import type { AdministrativeTaskType, TaskEntityRefs } from '@indii/shared';
import { logger } from '@/utils/logger';

const TASKS_COLLECTION = 'administrative_tasks';
const MAX_QUERY_LIMIT = 100;

type FirestoreTask = {
    id: string;
    type: AdministrativeTaskType;
    severity: string;
    status: string;
    entityType: string;
    entityRefs: TaskEntityRefs;
    findings: unknown[];
    proposedAction: Record<string, unknown> | null;
    jevRef: Record<string, unknown> | null;
    dedupeKey: string;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    resolvedAt: Timestamp | null;
};

async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function requireUid(): string | null {
    return auth.currentUser?.uid ?? null;
}

function toMillis(value: Timestamp | null | undefined): number {
    return value?.toMillis?.() ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────
// catalog_query_gaps — read-only audit queue inspection
// ─────────────────────────────────────────────────────────────────────────

const catalog_query_gaps = wrapTool('catalog_query_gaps', async (args: {
    entityType?: 'master' | 'track' | 'release' | 'composition' | 'collaborator';
    severity?: 'info' | 'warning' | 'critical' | 'blocking';
    status?: 'open' | 'action_ready' | 'awaiting_confirmation' | 'executed' | 'dismissed' | 'failed';
    limit?: number;
}) => {
    const uid = requireUid();
    if (!uid) return toolError('User not authenticated');

    const cappedLimit = Math.min(Math.max(args.limit ?? 25, 1), MAX_QUERY_LIMIT);
    try {
        const constraints = [
            args.status ? where('status', '==', args.status) : undefined,
            args.severity ? where('severity', '==', args.severity) : undefined,
            args.entityType ? where('entityType', '==', args.entityType) : undefined,
        ].filter(Boolean);

        const page = await getDocs(query(
            collection(db, 'users', uid, TASKS_COLLECTION),
            ...constraints,
            fsLimit(MAX_QUERY_LIMIT),
        ));

        const tasks: FirestoreTask[] = [];
        page.forEach((document) => {
            tasks.push({ id: document.id, ...(document.data() as Omit<FirestoreTask, 'id'>) });
        });
        // Equality-only query (no composite index); order client-side, newest first.
        tasks.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        const page_ = tasks.slice(0, cappedLimit);
        const bySeverity: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        for (const task of tasks) {
            bySeverity[task.severity] = (bySeverity[task.severity] ?? 0) + 1;
            byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
        }

        return toolSuccess({
            tasks: page_.map((task) => ({
                id: task.id,
                type: task.type,
                severity: task.severity,
                status: task.status,
                entityType: task.entityType,
                entityRefs: task.entityRefs,
                findingCount: Array.isArray(task.findings) ? task.findings.length : 0,
                hasStagedAction: Boolean(task.proposedAction),
                stagedActionKind: task.proposedAction && typeof task.proposedAction === 'object'
                    ? (task.proposedAction as Record<string, unknown>)['kind']
                    : null,
            })),
            counts: { bySeverity, byStatus, scanned: tasks.length },
            note: 'Counts reflect the newest scanned page, not the whole history.',
        }, `Found ${tasks.length} administrative task(s); returning ${page_.length}.`);
    } catch (error: unknown) {
        logger.warn('[CatalogAdminTools] catalog_query_gaps failed:', error);
        return toolError(error instanceof Error ? error.message : 'Failed to query administrative tasks', 'QUERY_ERROR');
    }
});

// ─────────────────────────────────────────────────────────────────────────
// catalog_stage_registration_payload — build + stage a registration draft
// ─────────────────────────────────────────────────────────────────────────

type Registry = 'ISWC' | 'CWR' | 'DDEX_ERN';

interface ReleaseLikeData {
    metadata?: Record<string, unknown>;
    isrc?: string;
    iswc?: string;
    trackTitle?: string;
    title?: string;
}

function writerRowsFrom(metadata: Record<string, unknown>): { name: string; percentage: number; role: string }[] {
    const splits = (metadata['recordingSplits'] ?? metadata['splits'] ?? []) as Record<string, unknown>[];
    return splits.map((split) => ({
        name: String(split['legalName'] ?? split['name'] ?? 'unknown'),
        percentage: typeof split['percentage'] === 'number' ? split['percentage'] : Number.NaN,
        role: String(split['role'] ?? 'other'),
    }));
}

const catalog_stage_registration_payload = wrapTool('catalog_stage_registration_payload', async (args: {
    registry: Registry;
    releaseId?: string;
    trackId?: string;
    masterHash?: string;
}) => {
    const uid = requireUid();
    if (!uid) return toolError('User not authenticated');
    const { registry } = args;

    try {
        // Resolve the target entity — the payload is built from REAL stored
        // data, never from model-invented metadata.
        let payload: Record<string, unknown> | undefined;
        let refs: TaskEntityRefs;
        let workTitle = '';

        if (args.releaseId) {
            const snap = await getDoc(doc(db, 'proprietaryIngestionReleases', args.releaseId));
            if (!snap.exists()) return toolError(`Release ${args.releaseId} not found`, 'RELEASE_NOT_FOUND');
            const data = snap.data() as ReleaseLikeData;
            const metadata = (data.metadata ?? {}) as Record<string, unknown>;
            workTitle = String(metadata['trackTitle'] ?? data.trackTitle ?? data.title ?? '');
            refs = { releaseId: args.releaseId, masterHash: args.masterHash };
            payload = {
                registry,
                workTitle,
                isrc: metadata['isrc'] ?? data.isrc ?? null,
                iswc: metadata['iswc'] ?? data.iswc ?? null,
                writers: writerRowsFrom(metadata),
                proAffiliation: metadata['pro'] ?? null,
                publisher: metadata['publisher'] ?? null,
                releaseDate: metadata['releaseDate'] ?? null,
                language: metadata['language'] ?? null,
                explicit: metadata['explicit'] ?? null,
            };
        } else if (args.trackId) {
            const snap = await getDoc(doc(db, 'users', uid, 'tracks', args.trackId));
            if (!snap.exists()) return toolError(`Track ${args.trackId} not found`, 'TRACK_NOT_FOUND');
            const data = snap.data() as Record<string, unknown>;
            workTitle = String(data['title'] ?? '');
            refs = { trackId: args.trackId, masterHash: args.masterHash ?? undefined };
            payload = {
                registry,
                workTitle,
                isrc: data['isrc'] ?? null,
                iswc: data['iswc'] ?? null,
                language: data['language'] ?? null,
                explicit: data['explicit'] ?? null,
            };
        } else {
            return toolError('Provide releaseId or trackId — payloads are built from stored catalog records only.', 'NO_TARGET');
        }

        // Validation gate: registration payloads with unknown splits are not stageable.
        const writers = (payload['writers'] ?? []) as { name: string; percentage: number }[];
        if (writers.some((writer) => !Number.isFinite(writer.percentage))) {
            return toolError('Split data for this record is incomplete or malformed — resolve split tasks before staging a registration payload.', 'SPLITS_UNRESOLVED');
        }

        const dedupeSource = `${registry}|${canonicalAdministrativeTaskRefs(refs)}`;
        const digest = (await sha256Hex(dedupeSource)).slice(0, 24);
        const taskId = `REGISTRATION_PAYLOAD_STAGED_${digest}`;

        const taskDoc = {
            id: taskId,
            userId: uid,
            schemaVersion: 'administrative-task.v1',
            type: 'REGISTRATION_PAYLOAD_STAGED' as AdministrativeTaskType,
            severity: 'warning',
            status: 'action_ready',
            entityType: args.releaseId ? 'release' : 'track',
            entityRefs: refs,
            findings: [],
            proposedAction: {
                kind: 'staged_registration_payload',
                payload,
                requiresApproval: true,
                builderRef: `${registry.toLowerCase()}-builder@v1`,
            },
            jevRef: null,
            dedupeKey: taskId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            resolvedAt: null,
        };

        await setDoc(doc(db, 'users', uid, TASKS_COLLECTION, taskId), taskDoc);

        return toolSuccess({
            taskId,
            registry,
            status: 'staged_pending_confirmation',
            requiresApproval: true,
            note: 'Payload staged for one-click human confirmation. Nothing was submitted to any registry.',
        }, `Staged ${registry} registration payload for "${workTitle || (refs.releaseId ?? refs.trackId)}". Awaiting human confirmation to execute.`);
    } catch (error: unknown) {
        logger.warn('[CatalogAdminTools] catalog_stage_registration_payload failed:', error);
        return toolError(error instanceof Error ? error.message : 'Failed to stage registration payload', 'STAGE_ERROR');
    }
});

// ─────────────────────────────────────────────────────────────────────────
// catalog_dispatch_split_invitations — pre-filled signature invitations
// ─────────────────────────────────────────────────────────────────────────

const catalog_dispatch_split_invitations = wrapTool('catalog_dispatch_split_invitations', async (args: {
    releaseId: string;
    channel?: 'in_app' | 'email';
}) => {
    const uid = requireUid();
    if (!uid) return toolError('User not authenticated');
    const channel = args.channel ?? 'in_app';

    try {
        const snap = await getDoc(doc(db, 'proprietaryIngestionReleases', args.releaseId));
        if (!snap.exists()) return toolError(`Release ${args.releaseId} not found`, 'RELEASE_NOT_FOUND');

        const metadata = ((snap.data() as ReleaseLikeData).metadata ?? {}) as Record<string, unknown>;
        const splits = (metadata['recordingSplits'] ?? metadata['splits'] ?? []) as Record<string, unknown>[];
        if (!Array.isArray(splits) || splits.length === 0) {
            return toolError('No splits recorded for this release — nothing to invite.', 'NO_SPLITS');
        }
        const percentages = splits.map((split) => (typeof split['percentage'] === 'number' ? split['percentage'] : Number.NaN));
        if (!splitsResolveExactly(percentages)) {
            return toolError('Splits do not resolve to exactly 100.00% — resolve split-sum tasks before dispatching invitations.', 'SPLIT_SUM_INVALID');
        }

        // Deterministic sheet hash: identical splits → identical invitation ids.
        const roster = splits
            .map((split) => ({
                name: String(split['legalName'] ?? split['name'] ?? 'unknown'),
                percentage: split['percentage'] as number,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'en'));
        const sheetText = ['INDII SPLIT SHEET v1', `release: ${args.releaseId}`,
            ...roster.map((entry) => `collaborator: ${entry.name} | ${entry.percentage.toFixed(4)}%`)].join('\n');
        const sheetHash = await sha256Hex(sheetText);

        const invitations: { collaborator: string; taskId: string; created: boolean }[] = [];
        for (const entry of roster) {
            const dedupeSource = `${args.releaseId}|${entry.name}|${sheetHash}`;
            const digest = (await sha256Hex(dedupeSource)).slice(0, 24);
            const taskId = `SPLIT_SIGNATURE_OUTSTANDING_${digest}`;

            // Never resurrect a resolved invitation.
            const existing = await getDoc(doc(db, 'users', uid, TASKS_COLLECTION, taskId));
            if (existing.exists()) {
                const status = (existing.data() as { status?: string }).status;
                if (status === 'executed' || status === 'dismissed') {
                    invitations.push({ collaborator: entry.name, taskId, created: false });
                    continue;
                }
            }

            const tokenBytes = new Uint8Array(16);
            crypto.getRandomValues(tokenBytes);
            const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

            await setDoc(doc(db, 'users', uid, TASKS_COLLECTION, taskId), {
                id: taskId,
                userId: uid,
                schemaVersion: 'administrative-task.v1',
                type: 'SPLIT_SIGNATURE_OUTSTANDING',
                severity: 'critical',
                status: 'action_ready',
                entityType: 'collaborator',
                entityRefs: { releaseId: args.releaseId, collaboratorId: entry.name },
                findings: [{
                    field: 'signature',
                    expected: `${entry.name} signs the ${sheetHash.slice(0, 12)} split sheet`,
                    observed: 'unsigned',
                    source: 'split-invitation.v1',
                }],
                proposedAction: {
                    kind: 'split_invitation',
                    payload: {
                        invitee: entry.name,
                        sharePercentage: entry.percentage,
                        sheetHash,
                        releaseId: args.releaseId,
                        channel,
                        token,
                    },
                    requiresApproval: true,
                    builderRef: 'split-invitation@v1',
                },
                jevRef: null,
                dedupeKey: taskId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                resolvedAt: null,
            });
            invitations.push({ collaborator: entry.name, taskId, created: true });
        }

        return toolSuccess({
            releaseId: args.releaseId,
            sheetHash,
            channel,
            invitations,
            note: 'Invitations are staged in the administrative task queue for human confirmation. No email or message was sent.',
        }, `Staged ${invitations.filter((invite) => invite.created).length} split invitation(s) for release ${args.releaseId} (sheet ${sheetHash.slice(0, 12)}). Awaiting human confirmation to dispatch.`);
    } catch (error: unknown) {
        logger.warn('[CatalogAdminTools] catalog_dispatch_split_invitations failed:', error);
        return toolError(error instanceof Error ? error.message : 'Failed to dispatch split invitations', 'DISPATCH_ERROR');
    }
});

export const CatalogAdminTools = {
    catalog_query_gaps,
    catalog_stage_registration_payload,
    catalog_dispatch_split_invitations,
} satisfies Record<string, AnyToolFunction>;
