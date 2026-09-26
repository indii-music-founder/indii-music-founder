import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import {
    canonicalAdministrativeTaskRefs,
    splitsResolveExactly,
} from '@indii/shared';
import type { IndiiMcpTool } from '../types.js';
import { failedOperationResult, operationResult, toolResponse, requireString } from '../helpers.js';
import {
    auditCatalogEntity,
    buildAdministrativeTask,
    emitAdministrativeTasks,
    type CatalogEntitySnapshot,
} from '../../functions/audit/catalogAudit';

/**
 * stage_registration_payload — build and STAGE a pre-filled registration
 * payload from a stored catalog record (Post-Mastering Administrative Engine
 * P3 mirror; plan §2.3). Server-side twin of the renderer tool: same staged
 * task shape, same never-execute invariant. Nothing is submitted to any
 * registry — executing a staged payload is a separate, human-confirmed action.
 */

const REGISTRIES = ['ISWC', 'CWR', 'DDEX_ERN'] as const;
type Registry = (typeof REGISTRIES)[number];

function writerRows(metadata: Record<string, unknown>): { name: string; percentage: number; role: string }[] {
    const splits = (metadata['recordingSplits'] ?? metadata['splits'] ?? []) as Record<string, unknown>[];
    return splits.map((split) => ({
        name: String(split['legalName'] ?? split['name'] ?? 'unknown'),
        percentage: typeof split['percentage'] === 'number' ? split['percentage'] : Number.NaN,
        role: String(split['role'] ?? 'other'),
    }));
}

function splitEntries(metadata: Record<string, unknown>): { collaboratorId?: string; name?: string; percentage: number }[] | null {
    const splits = (metadata['recordingSplits'] ?? metadata['splits'] ?? null) as Record<string, unknown>[] | null;
    if (!Array.isArray(splits)) return null;
    return splits.map((split) => ({
        collaboratorId: typeof split['collaboratorId'] === 'string' ? split['collaboratorId'] : undefined,
        name: typeof split['legalName'] === 'string' ? split['legalName'] : typeof split['name'] === 'string' ? split['name'] : undefined,
        percentage: typeof split['percentage'] === 'number' ? split['percentage'] : Number.NaN,
    }));
}

function snapshotFromRelease(metadata: Record<string, unknown>): CatalogEntitySnapshot {
    const recordingSplits = splitEntries(metadata);
    const compositionRaw = (metadata['compositionSplits'] ?? null) as Record<string, unknown>[] | null;
    const compositionSplits = Array.isArray(compositionRaw)
        ? compositionRaw.map((split) => ({
            collaboratorId: typeof split['collaboratorId'] === 'string' ? split['collaboratorId'] : undefined,
            name: typeof split['legalName'] === 'string' ? split['legalName'] : undefined,
            percentage: typeof split['percentage'] === 'number' ? split['percentage'] : Number.NaN,
        }))
        : null;
    return {
        title: typeof metadata['trackTitle'] === 'string' ? metadata['trackTitle'] : null,
        isrc: typeof metadata['isrc'] === 'string' ? metadata['isrc'] : null,
        iswc: typeof metadata['iswc'] === 'string' ? metadata['iswc'] : null,
        upc: typeof metadata['upc'] === 'string' ? metadata['upc'] : null,
        explicitFlag: typeof metadata['explicit'] === 'boolean' ? metadata['explicit'] : null,
        releaseDate: typeof metadata['releaseDate'] === 'string' ? metadata['releaseDate'] : null,
        territories: Array.isArray(metadata['territories']) ? metadata['territories'] as string[] : null,
        language: typeof metadata['language'] === 'string' ? metadata['language'] : null,
        recordingYear: typeof metadata['recordingYear'] === 'number' ? metadata['recordingYear'] : null,
        artistRoles: Array.isArray(metadata['artistRoles']) ? metadata['artistRoles'] as string[] : null,
        recordingSplits,
        compositionSplits,
        writers: recordingSplits?.map((split) => ({
            name: split.name ?? 'unknown',
            proAffiliation: null,
            ipiNumber: null,
        })) ?? null,
        requireSplits: true,
    };
}

export const stageRegistrationPayload: IndiiMcpTool = {
    name: 'stage_registration_payload',
    description: 'Build and STAGE a pre-filled ISWC/CWR/DDEX_ERN registration payload from a stored catalog record. Stages an administrative task awaiting explicit human confirmation — NEVER submits to any registry.',
    inputSchema: {
        type: 'object',
        properties: {
            registry: { type: 'string', enum: REGISTRIES, description: 'Target registration system.' },
            releaseId: { type: 'string', description: 'proprietaryIngestionReleases document id (verified owned).' },
            trackId: { type: 'string', description: 'Track library id (used when no releaseId).' },
        },
        required: ['registry'],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;
        let trackId = 'unknown';
        try {
            const registry = requireString(args, 'registry', 16) as Registry;
            if (!REGISTRIES.includes(registry)) {
                throw new TypeError(`registry must be one of ${REGISTRIES.join(', ')}.`);
            }

            const firestore = admin.firestore();
            let payload: Record<string, unknown>;
            let refs: Record<string, string>;
            let workTitle = '';

            if (args.releaseId !== undefined) {
                const releaseId = requireString(args, 'releaseId', 200);
                trackId = releaseId;
                const snap = await firestore.collection('proprietaryIngestionReleases').doc(releaseId).get();
                if (!snap.exists) {
                    return toolResponse(failedOperationResult({
                        tool: 'stage_registration_payload', actorUid, resourceType: 'administrative_task',
                        resourceId: releaseId, code: 'RELEASE_NOT_FOUND',
                        message: `Release ${releaseId} not found.`, retryable: false,
                    }));
                }
                const metadata = ((snap.data() ?? {})['metadata'] ?? {}) as Record<string, unknown>;
                workTitle = String(metadata['trackTitle'] ?? '');
                refs = { releaseId };
                payload = {
                    registry,
                    workTitle,
                    isrc: metadata['isrc'] ?? null,
                    iswc: metadata['iswc'] ?? null,
                    upc: metadata['upc'] ?? null,
                    writers: writerRows(metadata),
                    proAffiliation: metadata['pro'] ?? null,
                    publisher: metadata['publisher'] ?? null,
                    releaseDate: metadata['releaseDate'] ?? null,
                    language: metadata['language'] ?? null,
                    explicit: metadata['explicit'] ?? null,
                };
                const writers = payload['writers'] as { percentage: number }[];
                if (writers.some((writer) => !Number.isFinite(writer.percentage))) {
                    return toolResponse(failedOperationResult({
                        tool: 'stage_registration_payload', actorUid, resourceType: 'administrative_task',
                        resourceId: releaseId, code: 'SPLITS_UNRESOLVED',
                        message: 'Split data is incomplete or malformed — resolve split tasks before staging.', retryable: false,
                    }));
                }
            } else if (args.trackId !== undefined) {
                const id = requireString(args, 'trackId', 200);
                trackId = id;
                const snap = await firestore.collection('users').doc(actorUid).collection('tracks').doc(id).get();
                if (!snap.exists) {
                    return toolResponse(failedOperationResult({
                        tool: 'stage_registration_payload', actorUid, resourceType: 'administrative_task',
                        resourceId: id, code: 'TRACK_NOT_FOUND', message: `Track ${id} not found.`, retryable: false,
                    }));
                }
                const data = snap.data() ?? {};
                workTitle = typeof data['title'] === 'string' ? data['title'] : '';
                refs = { trackId: id };
                payload = {
                    registry,
                    workTitle,
                    isrc: data['isrc'] ?? null,
                    iswc: data['iswc'] ?? null,
                    language: data['language'] ?? null,
                    explicit: data['explicit'] ?? null,
                };
            } else {
                return toolResponse(failedOperationResult({
                    tool: 'stage_registration_payload', actorUid, resourceType: 'administrative_task',
                    resourceId: 'none', code: 'NO_TARGET',
                    message: 'Provide releaseId or trackId — payloads are built from stored catalog records only.',
                    retryable: false,
                }));
            }

            // The audit core is the shared validity gate: if the entity fails
            // deterministic audit on blocking metadata/identifier grounds, the
            // payload would be garbage — refuse rather than stage junk.
            const snapshotMeta = args.releaseId
                ? ((await firestore.collection('proprietaryIngestionReleases').doc(String(refs['releaseId'])).get()).data() ?? {})['metadata'] as Record<string, unknown> ?? {}
                : {};
            const blocking = auditCatalogEntity(args.releaseId
                ? snapshotFromRelease(snapshotMeta)
                : { requireSplits: false }).filter((result) => result.severity === 'blocking');
            if (blocking.length > 0) {
                return toolResponse(failedOperationResult({
                    tool: 'stage_registration_payload', actorUid, resourceType: 'administrative_task',
                    resourceId: trackId, code: 'BLOCKING_AUDIT_FINDINGS',
                    message: `Blocking audit findings must be resolved first: ${blocking.map((result) => result.taskType).join(', ')}.`,
                    retryable: false,
                }));
            }

            const dedupeSource = `${registry}|${canonicalAdministrativeTaskRefs(refs as never)}`;
            const digest = createHash('sha256').update(dedupeSource, 'utf8').digest('hex').slice(0, 24);
            const taskId = `REGISTRATION_PAYLOAD_STAGED_${digest}`;

            const task = buildAdministrativeTask({
                userId: actorUid,
                type: 'REGISTRATION_PAYLOAD_STAGED',
                severity: 'warning',
                entityType: args.releaseId ? 'release' : 'track',
                refs: refs as never,
                findings: [],
                proposedAction: {
                    kind: 'staged_registration_payload',
                    payload,
                    requiresApproval: true,
                    builderRef: `${registry.toLowerCase()}-builder@v1`,
                },
            });

            const writeable = {
                collection: (path: string) => ({
                    doc: (id: string) => ({
                        id,
                        get: async () => {
                            const snap = await firestore.collection(path).doc(id).get();
                            return { exists: snap.exists, data: () => snap.data() as Record<string, unknown> | undefined };
                        },
                        set: async (data: unknown) => { await firestore.collection(path).doc(id).set(data as never); },
                    }),
                }),
            };
            const emitted = await emitAdministrativeTasks(writeable, [task]);
            const staged = emitted.written.length > 0;

            return toolResponse(operationResult({
                tool: 'stage_registration_payload',
                actorUid,
                status: staged ? 'requires_approval' : 'succeeded',
                resourceType: 'administrative_task',
                resourceId: taskId,
                approvalRequired: staged,
                data: {
                    taskId: task.id,
                    registry,
                    workTitle,
                    splitsResolveExactly: splitsResolveExactly((payload['writers'] as { percentage: number }[] | undefined)?.map((writer) => writer.percentage) ?? []),
                    disposition: staged ? 'staged_pending_confirmation' : 'already_resolved',
                    note: staged
                        ? 'Payload staged. Human confirmation is required to execute; nothing was submitted to any registry.'
                        : 'A previously resolved task already covers this payload — nothing was overwritten.',
                },
            }));
        } catch (error: unknown) {
            return toolResponse(failedOperationResult({
                tool: 'stage_registration_payload',
                actorUid,
                resourceType: 'administrative_task',
                resourceId: trackId,
                code: 'STAGE_FAILED',
                message: error instanceof Error ? error.message : 'Failed to stage registration payload.',
                retryable: true,
            }));
        }
    },
};
