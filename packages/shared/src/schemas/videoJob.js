"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoJobDocumentSchema = exports.VideoJobDirectorSettingsSchema = exports.VideoJobPayloadSchema = exports.VideoJobDirectorPhysicsSchema = exports.VideoJobModeSchema = exports.VideoJobStatusSchema = void 0;
const zod_1 = require("zod");
exports.VideoJobStatusSchema = zod_1.z.enum([
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
exports.VideoJobModeSchema = zod_1.z.enum([
    'text_to_video',
    'image_to_video',
    'temporal_inpaint',
    'video_remix',
    'long_form',
    'video',
]);
exports.VideoJobDirectorPhysicsSchema = zod_1.z.object({
    pan: zod_1.z.number().optional(),
    tilt: zod_1.z.number().optional(),
    zoom: zod_1.z.number().optional(),
    crane: zod_1.z.number().optional(),
}).partial();
exports.VideoJobPayloadSchema = zod_1.z.object({
    prompt: zod_1.z.string().min(1),
    sourceVideoUri: zod_1.z.string().startsWith('gs://').optional(),
    maskFrameUri: zod_1.z.string().startsWith('gs://').optional(),
    cameraPhysics: exports.VideoJobDirectorPhysicsSchema.optional(),
}).passthrough();
exports.VideoJobDirectorSettingsSchema = zod_1.z.object({
    fps: zod_1.z.number().int().positive().default(24),
    durationSeconds: zod_1.z.number().positive().optional(),
    totalFrames: zod_1.z.number().int().nonnegative().optional(),
    aspectRatio: zod_1.z.enum(['16:9', '9:16', '1:1']).optional(),
    resolution: zod_1.z.enum(['720p', '1080p', '4k']).optional(),
    seed: zod_1.z.union([zod_1.z.number().int(), zod_1.z.string()]).optional(),
    cameraPhysics: exports.VideoJobDirectorPhysicsSchema.optional(),
    firstFrameUri: zod_1.z.string().startsWith('gs://').optional(),
    lastFrameUri: zod_1.z.string().startsWith('gs://').optional(),
    cameraMovement: zod_1.z.string().optional(),
    motionStrength: zod_1.z.number().min(0).max(1).optional(),
}).passthrough();
exports.VideoJobDocumentSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    schemaVersion: zod_1.z.number().int().positive().default(1),
    userId: zod_1.z.string().min(1),
    orgId: zod_1.z.string().optional(),
    projectId: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    mode: exports.VideoJobModeSchema,
    status: exports.VideoJobStatusSchema,
    progress: zod_1.z.number().min(0).max(100).default(0),
    prompt: zod_1.z.string().min(1).optional(),
    payload: exports.VideoJobPayloadSchema,
    directorSettings: exports.VideoJobDirectorSettingsSchema.optional(),
    inputUris: zod_1.z.array(zod_1.z.string().startsWith('gs://')).default([]),
    tempUris: zod_1.z.array(zod_1.z.string().startsWith('gs://')).default([]),
    persistentUris: zod_1.z.array(zod_1.z.string().startsWith('gs://')).default([]),
    maskMetadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    operationName: zod_1.z.string().optional(),
    provider: zod_1.z.string().optional(),
    model: zod_1.z.string().optional(),
    costEstimate: zod_1.z.number().optional(),
    costReservationId: zod_1.z.string().optional(),
    retryCount: zod_1.z.number().int().min(0).default(0),
    error: zod_1.z.string().optional(),
    createdAt: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    updatedAt: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    completedAt: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    cancelledAt: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    resultUri: zod_1.z.string().startsWith('gs://').optional(),
    downloadUrl: zod_1.z.string().url().optional(),
    videoUrl: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    output: zod_1.z.object({
        url: zod_1.z.string().optional(),
        metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    }).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
}).passthrough();
//# sourceMappingURL=videoJob.js.map