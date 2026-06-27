import { z } from 'zod';

export const VideoJobStatusSchema = z.enum([
    'PENDING',
    'QUEUED',
    'PROCESSING',
    'STITCHING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'queued',
    'processing',
    'stitching',
    'completed',
    'failed',
    'cancelled',
]);

export const VideoJobModeSchema = z.enum([
    'text_to_video',
    'image_to_video',
    'temporal_inpaint',
    'video_remix',
    'long_form',
    'video',
]);

export const VideoJobDirectorPhysicsSchema = z.object({
    pan: z.number().optional(),
    tilt: z.number().optional(),
    zoom: z.number().optional(),
    crane: z.number().optional(),
}).partial();

export const VideoJobPayloadSchema = z.object({
    prompt: z.string().min(1),
    sourceVideoUri: z.string().startsWith('gs://').optional(),
    maskFrameUri: z.string().startsWith('gs://').optional(),
    cameraPhysics: VideoJobDirectorPhysicsSchema.optional(),
}).passthrough();

export const VideoJobDirectorSettingsSchema = z.object({
    fps: z.number().int().positive().default(24),
    durationSeconds: z.number().positive().optional(),
    totalFrames: z.number().int().nonnegative().optional(),
    aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
    resolution: z.enum(['720p', '1080p', '4k']).optional(),
    seed: z.union([z.number().int(), z.string()]).optional(),
    cameraPhysics: VideoJobDirectorPhysicsSchema.optional(),
    firstFrameUri: z.string().startsWith('gs://').optional(),
    lastFrameUri: z.string().startsWith('gs://').optional(),
    cameraMovement: z.string().optional(),
    motionStrength: z.number().min(0).max(1).optional(),
}).passthrough();

export const VideoJobDocumentSchema = z.object({
    id: z.string().min(1),
    schemaVersion: z.number().int().positive().default(1),
    userId: z.string().min(1),
    orgId: z.string().optional(),
    projectId: z.string().optional(),
    sessionId: z.string().optional(),
    mode: VideoJobModeSchema,
    status: VideoJobStatusSchema,
    progress: z.number().min(0).max(100).default(0),
    prompt: z.string().min(1).optional(),
    payload: VideoJobPayloadSchema,
    directorSettings: VideoJobDirectorSettingsSchema.optional(),
    inputUris: z.array(z.string().startsWith('gs://')).default([]),
    tempUris: z.array(z.string().startsWith('gs://')).default([]),
    persistentUris: z.array(z.string().startsWith('gs://')).default([]),
    maskMetadata: z.record(z.unknown()).optional(),
    operationName: z.string().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    costEstimate: z.number().optional(),
    costReservationId: z.string().optional(),
    retryCount: z.number().int().min(0).default(0),
    error: z.string().optional(),
    createdAt: z.union([z.string(), z.number()]),
    updatedAt: z.union([z.string(), z.number()]),
    completedAt: z.union([z.string(), z.number()]).optional(),
    cancelledAt: z.union([z.string(), z.number()]).optional(),
    resultUri: z.string().startsWith('gs://').optional(),
    downloadUrl: z.string().url().optional(),
    videoUrl: z.string().optional(),
    url: z.string().optional(),
    output: z.object({
        url: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
    }).optional(),
    metadata: z.record(z.unknown()).optional(),
}).passthrough();

export type VideoJobDocument = z.infer<typeof VideoJobDocumentSchema>;
