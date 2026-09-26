/**
 * AdministrativeTasks — the output queue of the autonomous background audit
 * monitors (Post-Mastering Administrative Engine, P1; plan §1.2).
 *
 * Hard invariant: the engine STAGES, it never executes. Every proposed action
 * carries `requiresApproval: true` (enforced by the schema below AND by
 * firestore.rules) so a single human confirmation is always the only path to
 * execution.
 *
 * Document ids are deterministic dedupe keys:
 *   `${type}_${sha256(canonical(entityRefs)).slice(0, 24)}`
 * so a re-audit can never create a duplicate task.
 */

import { z } from 'zod';

export const ADMINISTRATIVE_TASK_SCHEMA_VERSION = 'administrative-task.v1';

export const ADMINISTRATIVE_TASK_TYPES = [
    // Identifier cross-validation
    'IDENTIFIER_ISRC_WITHOUT_ISWC',
    'IDENTIFIER_ISWC_WITHOUT_ISRC',
    'IDENTIFIER_FORMAT_INVALID',
    'IDENTIFIER_POOL_MISMATCH',
    // Split completeness / integrity
    'SPLIT_SUM_MASTER',
    'SPLIT_SUM_PUBLISHING',
    'SPLIT_PRO_AFFILIATION_MISSING',
    'SPLIT_IPI_MISSING',
    'SPLIT_SIGNATURE_OUTSTANDING',
    // Metadata anomalies
    'METADATA_MANDATORY_FIELD',
    'METADATA_TAG_CONFLICT',
    // Actionable staged output
    'REGISTRATION_PAYLOAD_STAGED',
] as const;

export const ADMINISTRATIVE_TASK_SEVERITIES = ['info', 'warning', 'critical', 'blocking'] as const;
export const ADMINISTRATIVE_TASK_STATUSES = [
    'open',
    'action_ready',
    'awaiting_confirmation',
    'executed',
    'dismissed',
    'failed',
] as const;
export const ADMINISTRATIVE_TASK_ENTITY_TYPES = [
    'master',
    'track',
    'release',
    'composition',
    'collaborator',
] as const;
export const ADMINISTRATIVE_ACTION_KINDS = [
    'staged_registration_payload',
    'split_invitation',
    'metadata_patch',
] as const;

export const AdministrativeTaskTypeSchema = z.enum(ADMINISTRATIVE_TASK_TYPES);
export type AdministrativeTaskType = (typeof ADMINISTRATIVE_TASK_TYPES)[number];
export type AdministrativeTaskSeverity = (typeof ADMINISTRATIVE_TASK_SEVERITIES)[number];
export type AdministrativeTaskStatus = (typeof ADMINISTRATIVE_TASK_STATUSES)[number];

export const TaskEntityRefsSchema = z
    .object({
        masterHash: z.string().regex(/^[0-9a-f]{16,64}$/).optional(),
        trackId: z.string().min(1).max(160).optional(),
        releaseId: z.string().min(1).max(160).optional(),
        splitSheetHash: z.string().regex(/^[0-9a-f]{8,64}$/).optional(),
        collaboratorId: z.string().min(1).max(160).optional(),
    })
    .strict();
export type TaskEntityRefs = z.infer<typeof TaskEntityRefsSchema>;

export const TaskFindingSchema = z
    .object({
        field: z.string().min(1).max(120),
        expected: z.string().max(500),
        observed: z.string().max(500),
        source: z.string().min(1).max(120),
    })
    .strict();
export type TaskFinding = z.infer<typeof TaskFindingSchema>;

/**
 * The pre-filled reconciliation draft. `requiresApproval` is a LITERAL true:
 * the type system itself refuses an auto-executable action.
 */
export const TaskProposedActionSchema = z
    .object({
        kind: z.enum(ADMINISTRATIVE_ACTION_KINDS),
        payload: z.record(z.unknown()),
        requiresApproval: z.literal(true),
        builderRef: z.string().min(1).max(128),
    })
    .strict();
export type TaskProposedAction = z.infer<typeof TaskProposedActionSchema>;

/** Receipt of a Jev judgment that refined this task — never an authority. */
export const TaskJevRefSchema = z
    .object({
        judgment: z.string().min(1).max(120),
        confidence: z.number().min(0).max(1),
        model: z.string().min(1).max(64),
    })
    .strict();
export type TaskJevRef = z.infer<typeof TaskJevRefSchema>;

export const AdministrativeTaskSchema = z
    .object({
        id: z.string().min(8).max(160),
        userId: z.string().min(1).max(128),
        schemaVersion: z.literal(ADMINISTRATIVE_TASK_SCHEMA_VERSION),
        type: AdministrativeTaskTypeSchema,
        severity: z.enum(ADMINISTRATIVE_TASK_SEVERITIES),
        status: z.enum(ADMINISTRATIVE_TASK_STATUSES),
        entityType: z.enum(ADMINISTRATIVE_TASK_ENTITY_TYPES),
        entityRefs: TaskEntityRefsSchema,
        findings: z.array(TaskFindingSchema).max(50),
        proposedAction: TaskProposedActionSchema.nullable(),
        jevRef: TaskJevRefSchema.nullable(),
        dedupeKey: z.string().min(8).max(160),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        resolvedAt: z.string().datetime().nullable(),
    })
    .strict()
    .superRefine((task, ctx) => {
        if (task.id !== task.dedupeKey) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['id'],
                message: 'Document id must equal the deterministic dedupeKey.',
            });
        }
        if ((task.status === 'executed' || task.status === 'dismissed') && !task.resolvedAt) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['resolvedAt'],
                message: `status '${task.status}' requires resolvedAt.`,
            });
        }
        if (task.status === 'action_ready' && !task.proposedAction) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['proposedAction'],
                message: "status 'action_ready' requires a staged proposedAction.",
            });
        }
    });

export type AdministrativeTask = z.infer<typeof AdministrativeTaskSchema>;

/**
 * Canonical, key-order-stable rendering of the entity refs — the exact string
 * callers hash (node:crypto sha256 on the cloud side) to build the
 * dedupeKey/document id: `{type}_{sha256(canonical)[:24]}`.
 */
export function canonicalAdministrativeTaskRefs(refs: TaskEntityRefs): string {
    return Object.keys(refs)
        .sort()
        .filter((key) => {
            const value = (refs as Record<string, unknown>)[key];
            return value !== undefined && value !== null && value !== '';
        })
        .map((key) => `${key}=${(refs as Record<string, unknown>)[key]}`)
        .join('|');
}
