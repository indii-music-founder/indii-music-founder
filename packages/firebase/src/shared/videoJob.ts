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
    maskTrackUri: z.string().startsWith('gs://').optional(),
    frameRange: z.object({
        startFrame: z.number().int().min(0),
        endFrame: z.number().int().min(0),
    }).optional(),
    inputManifest: z.union([z.string(), z.record(z.unknown()), z.array(z.record(z.unknown()))]).optional(),
    cameraPhysics: VideoJobDirectorPhysicsSchema.optional(),
});

export const VideoJobDirectorSettingsSchema = z.object({
    fps: z.number().int().positive().default(24),
    // ISSUE-1379 class: clients serialize absent values as null (JSON has no
    // undefined). nullish() treats null exactly like undefined everywhere, so
    // no missing setting can ever reject the payload.
    durationSeconds: z.number().positive().nullish(),
    totalFrames: z.number().int().nonnegative().nullish(),
    aspectRatio: z.enum(['16:9', '9:16', '1:1']).nullish(),
    resolution: z.enum(['720p', '1080p', '4k']).nullish(),
    seed: z.union([z.number().int(), z.string()]).nullish(),
    cameraPhysics: VideoJobDirectorPhysicsSchema.nullish(),
    firstFrameUri: z.string().startsWith('gs://').nullish(),
    lastFrameUri: z.string().startsWith('gs://').nullish(),
    cameraMovement: z.string().nullish(),
    motionStrength: z.number().min(0).max(1).nullish(),
});

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
    maskUris: z.array(z.string().startsWith('gs://')).default([]),
    maskMetadata: z.record(z.unknown()).optional(),
    operationName: z.string().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    costEstimate: z.number().optional(),
    costReservationId: z.string().optional(),
    actualCost: z.number().optional(),
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
});

export type VideoJobDocument = z.infer<typeof VideoJobDocumentSchema>;
