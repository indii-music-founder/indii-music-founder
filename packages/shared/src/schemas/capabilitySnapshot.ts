import { z } from 'zod';

export const CAPABILITY_SNAPSHOT_SCHEMA_VERSION = 'capability-snapshot.v1' as const;

export const CapabilityStatusSchema = z.enum([
    'available',
    'degraded',
    'blocked',
    'unverified',
]);

export const CapabilityKeySchema = z.enum([
    'specialist_routing',
    'image_generation',
    'video_generation',
    'durable_workspace',
    'durable_memory',
    'calendar_connection',
    'calendar_actions',
    'social_connection',
    'social_publishing',
]);

export const CapabilityEvidenceSchema = z.object({
    status: CapabilityStatusSchema,
    observedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    approvalRequired: z.boolean().optional(),
}).strict();

export const CapabilityMapSchema = z.object({
    specialist_routing: CapabilityEvidenceSchema,
    image_generation: CapabilityEvidenceSchema,
    video_generation: CapabilityEvidenceSchema,
    durable_workspace: CapabilityEvidenceSchema,
    durable_memory: CapabilityEvidenceSchema,
    calendar_connection: CapabilityEvidenceSchema,
    calendar_actions: CapabilityEvidenceSchema,
    social_connection: CapabilityEvidenceSchema,
    social_publishing: CapabilityEvidenceSchema,
}).strict();

export const CapabilitySnapshotSchema = z.object({
    schemaVersion: z.literal(CAPABILITY_SNAPSHOT_SCHEMA_VERSION),
    observedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    capabilities: CapabilityMapSchema,
}).strict();

export type CapabilityStatus = z.infer<typeof CapabilityStatusSchema>;
export type CapabilityKey = z.infer<typeof CapabilityKeySchema>;
export type CapabilityEvidence = z.infer<typeof CapabilityEvidenceSchema>;
export type CapabilitySnapshot = z.infer<typeof CapabilitySnapshotSchema>;
