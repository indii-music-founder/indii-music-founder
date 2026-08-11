import { z } from 'zod';

export const TrashResourceTypeSchema = z.enum([
    'file_nodes',
    'history',
    'brand_assets',
    'knowledge_docs',
    'local_files',
]);
export type TrashResourceType = z.infer<typeof TrashResourceTypeSchema>;

export const TrashLifecycleStateSchema = z.enum([
    'trashing',
    'trashed',
    'restoring',
    'restored',
    'purging',
    'purged',
]);
export type TrashLifecycleState = z.infer<typeof TrashLifecycleStateSchema>;

export const TrashActorSchema = z.enum(['user', 'agent']);
export type TrashActor = z.infer<typeof TrashActorSchema>;

export const TrashTargetSchema = z.object({
    type: TrashResourceTypeSchema,
    targetId: z.string().min(1, 'Target ID must be a non-empty stable resource identifier'),
    folderId: z.string().optional(), // Required for local_files
});
export type TrashTarget = z.infer<typeof TrashTargetSchema>;

export const TrashProvenanceSchema = z.object({
    actor: TrashActorSchema,
    agentId: z.string().optional(),
    agentName: z.string().optional(),
    traceId: z.string().optional(),
    reason: z.string().optional(),
});
export type TrashProvenance = z.infer<typeof TrashProvenanceSchema>;

export const TrashDeviceInfoSchema = z.object({
    deviceId: z.string(),
    isAvailable: z.boolean(),
    approvedFolderId: z.string().optional(),
    approvedFolderPath: z.string().optional(),
});
export type TrashDeviceInfo = z.infer<typeof TrashDeviceInfoSchema>;

export const LegalHoldSchema = z.object({
    isLocked: z.boolean(),
    lockReason: z.string().optional(),
    lockedBy: z.string().optional(),
    lockedAt: z.string().optional(),
});
export type LegalHold = z.infer<typeof LegalHoldSchema>;

export const TrashItemEntrySchema = z.object({
    id: z.string(),
    relativePath: z.string(),
    name: z.string(),
    sizeBytes: z.number().nonnegative(),
    mimeType: z.string().optional(),
    isDirectory: z.boolean(),
    quarantinePath: z.string().optional(),
    checksum: z.string().optional(),
});
export type TrashItemEntry = z.infer<typeof TrashItemEntrySchema>;

export const TrashItemSchema = z.object({
    id: z.string(),
    userId: z.string(),
    projectId: z.string().optional(),
    orgId: z.string().optional(),
    type: TrashResourceTypeSchema,
    targetId: z.string(),
    name: z.string(),
    originalLocation: z.string(),
    mimeType: z.string().optional(),
    sizeBytes: z.number().nonnegative().optional(),
    provenance: TrashProvenanceSchema,
    state: TrashLifecycleStateSchema,
    idempotencyKey: z.string(),
    quarantinePath: z.string().optional(),
    restoreData: z.record(z.string(), z.unknown()).default({}),
    deviceInfo: TrashDeviceInfoSchema.optional(),
    legalHold: LegalHoldSchema.default({ isLocked: false }),
    hasEntries: z.boolean().default(false), // True if folder/compound asset with entries subcollection
    trashedAt: z.string(),
    updatedAt: z.string(),
    restoredAt: z.string().optional(),
    purgedAt: z.string().optional(),
});
export type TrashItem = z.infer<typeof TrashItemSchema>;

export const TrashPurgeIntentSchema = z.object({
    intentToken: z.string(),
    trashIds: z.array(z.string()).min(1),
    userId: z.string(),
    expiresAt: z.number(),
});
export type TrashPurgeIntent = z.infer<typeof TrashPurgeIntentSchema>;

// IPC contract types for Electron safe local trash
export const LocalTrashMoveRequestSchema = z.object({
    approvedFolderId: z.string(),
    relativePath: z.string(),
    trashId: z.string(),
});
export type LocalTrashMoveRequest = z.infer<typeof LocalTrashMoveRequestSchema>;

export const LocalTrashRestoreRequestSchema = z.object({
    approvedFolderId: z.string(),
    trashId: z.string(),
    relativePath: z.string(),
    targetRelativePath: z.string().optional(),
});
export type LocalTrashRestoreRequest = z.infer<typeof LocalTrashRestoreRequestSchema>;

export const LocalTrashPurgeRequestSchema = z.object({
    approvedFolderId: z.string(),
    trashId: z.string(),
});
export type LocalTrashPurgeRequest = z.infer<typeof LocalTrashPurgeRequestSchema>;
