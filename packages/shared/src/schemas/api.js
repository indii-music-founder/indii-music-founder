"use strict";
/**
 * API schemas for indii REST API
 *
 * Defines all request/response types for:
 * - Track management endpoints
 * - Analytics endpoints
 * - Distribution endpoints
 * - Webhook endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorResponseSchema = exports.ApiResponseSchema = exports.CreateWebhookSchema = exports.WebhookSchema = exports.CreateDistributionSchema = exports.DistributionSchema = exports.AnalyticsQuerySchema = exports.AnalyticsEventSchema = exports.UpdateTrackSchema = exports.CreateTrackSchema = exports.TrackSchema = void 0;
const zod_1 = require("zod");
// Track Schemas
exports.TrackSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    artistId: zod_1.z.string().uuid(),
    genre: zod_1.z.string().optional(),
    bpm: zod_1.z.number().optional(),
    duration: zod_1.z.number(), // milliseconds
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CreateTrackSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    genre: zod_1.z.string().optional(),
    bpm: zod_1.z.number().optional(),
    duration: zod_1.z.number(),
});
exports.UpdateTrackSchema = exports.CreateTrackSchema.partial();
// Analytics Schemas
exports.AnalyticsEventSchema = zod_1.z.object({
    eventId: zod_1.z.string(),
    eventType: zod_1.z.string(),
    userId: zod_1.z.string(),
    timestamp: zod_1.z.number(),
    data: zod_1.z.record(zod_1.z.unknown()),
});
exports.AnalyticsQuerySchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime(),
    endDate: zod_1.z.string().datetime(),
    eventTypes: zod_1.z.array(zod_1.z.string()).optional(),
    limit: zod_1.z.number().int().positive().max(1000).default(100),
    offset: zod_1.z.number().int().nonnegative().default(0),
});
// Distribution Schemas
exports.DistributionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    trackId: zod_1.z.string().uuid(),
    platforms: zod_1.z.array(zod_1.z.enum(['spotify', 'apple', 'amazon', 'youtube', 'tiktok'])),
    status: zod_1.z.enum(['draft', 'scheduled', 'submitted', 'completed', 'failed']),
    scheduledDate: zod_1.z.string().datetime().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CreateDistributionSchema = zod_1.z.object({
    trackId: zod_1.z.string().uuid(),
    platforms: zod_1.z.array(zod_1.z.enum(['spotify', 'apple', 'amazon', 'youtube', 'tiktok'])).min(1),
    scheduledDate: zod_1.z.string().datetime().optional(),
});
// Webhook Schemas
exports.WebhookSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    url: zod_1.z.string().url(),
    events: zod_1.z.array(zod_1.z.string()).min(1),
    isActive: zod_1.z.boolean().default(true),
    secret: zod_1.z.string(), // HMAC secret
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CreateWebhookSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    events: zod_1.z.array(zod_1.z.string()).min(1),
});
// API Response Wrapper
exports.ApiResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.unknown().optional(),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        details: zod_1.z.record(zod_1.z.unknown()).optional(),
    }).optional(),
    meta: zod_1.z.object({
        timestamp: zod_1.z.number(),
        requestId: zod_1.z.string(),
        version: zod_1.z.string(),
    }).optional(),
});
// Error Response
exports.ErrorResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(false),
    error: zod_1.z.object({
        code: zod_1.z.enum(['INVALID_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'INTERNAL_ERROR']),
        message: zod_1.z.string(),
        details: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
    meta: zod_1.z.object({
        timestamp: zod_1.z.number(),
        requestId: zod_1.z.string(),
    }),
});
//# sourceMappingURL=api.js.map